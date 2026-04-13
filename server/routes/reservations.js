const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');

const TOTAL_PCS = 50;

// ── GET AVAILABILITY ─────────────────────────────────────────
// GET /api/reservations/availability?lab=Lab%20524&date=2026-04-15
router.get('/availability', verifyToken, async (req, res) => {
  const { lab, date } = req.query;

  if (!lab || !date) {
    return res.status(400).json({ message: 'Lab and date are required.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT pc_number, status FROM reservations
       WHERE lab = ? AND reserved_date = ?
       AND status IN ('approved', 'pending')`,
      [lab, date],
    );

    const [blocks] = await pool.query(
      `SELECT pc_number FROM admin_pc_blocks
       WHERE lab = ? AND blocked_date = ?`,
      [lab, date],
    );

    const blockedSet = new Set(blocks.map((b) => b.pc_number));

    const pcs = [];
    for (let i = 1; i <= TOTAL_PCS; i++) {
      let status;
      if (blockedSet.has(i)) {
        status = 'blocked';
      } else {
        const found = rows.find((r) => r.pc_number === i);
        status = found ? found.status : 'available';
      }
      pcs.push({ pc_number: i, status });
    }

    return res.status(200).json({ pcs });
  } catch (err) {
    console.error('Get availability error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── CREATE RESERVATION ───────────────────────────────────────
// POST /api/reservations
router.post('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Students only.' });
  }

  const { lab, pc_number, reserved_date } = req.body;

  if (!lab || !pc_number || !reserved_date) {
    return res.status(400).json({ message: 'Lab, PC number, and date are required.' });
  }

  if (pc_number < 1 || pc_number > TOTAL_PCS) {
    return res.status(400).json({ message: 'Invalid PC number.' });
  }

  try {
    // Check if PC is already reserved that day (pending or approved)
    const [existing] = await pool.query(
      `SELECT id FROM reservations
       WHERE lab = ? AND pc_number = ? AND reserved_date = ?
       AND status IN ('pending', 'approved')`,
      [lab, pc_number, reserved_date],
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'This PC is already reserved for that date.' });
    }

    // Check if admin has blocked this PC for that date
    const [blocked] = await pool.query(
      `SELECT id FROM admin_pc_blocks
       WHERE lab = ? AND pc_number = ? AND blocked_date = ?`,
      [lab, pc_number, reserved_date],
    );

    if (blocked.length > 0) {
      return res.status(409).json({ message: 'This PC is unavailable for that date.' });
    }

    // Get student name
    const [userRows] = await pool.query(
      `SELECT first_name, middle_name, last_name FROM users WHERE id_number = ?`,
      [req.user.id],
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const u = userRows[0];
    const studentName = [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ');

    await pool.query(
      `INSERT INTO reservations (id_number, student_name, lab, pc_number, reserved_date, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, studentName, lab, pc_number, reserved_date],
    );

    return res.status(201).json({ message: 'Reservation submitted! Waiting for admin approval.' });
  } catch (err) {
    console.error('Create reservation error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET MY RESERVATIONS ──────────────────────────────────────
// GET /api/reservations/my
router.get('/my', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, lab, pc_number, reserved_date, status, created_at, decided_at
       FROM reservations
       WHERE id_number = ?
       ORDER BY reserved_date DESC, created_at DESC`,
      [req.user.id],
    );

    return res.status(200).json({ reservations: rows });
  } catch (err) {
    console.error('Get my reservations error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── ADMIN: LIST ALL RESERVATIONS ─────────────────────────────
// GET /api/reservations/admin/all?status=pending
router.get('/admin/all', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only.' });
  }

  const statusFilter = req.query.status;
  let query = `SELECT id, id_number, student_name, lab, pc_number, reserved_date, status, created_at, decided_at
               FROM reservations`;
  const params = [];

  if (statusFilter) {
    query += ' WHERE status = ?';
    params.push(statusFilter);
  }
  query += ' ORDER BY created_at DESC';

  try {
    const [rows] = await pool.query(query, params);
    return res.status(200).json({ reservations: rows });
  } catch (err) {
    console.error('Admin list reservations error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── ADMIN: DECIDE RESERVATION (approve/reject) ───────────────
// POST /api/reservations/admin/:id/decide  body: { decision: 'approved' | 'rejected' }
router.post('/admin/:id/decide', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only.' });
  }

  const { decision } = req.body;
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ message: 'Invalid decision.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM reservations WHERE id = ?`,
      [req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Reservation not found.' });
    }

    const reservation = rows[0];

    if (reservation.status !== 'pending') {
      return res.status(409).json({ message: 'This reservation has already been decided.' });
    }

    await pool.query(
      `UPDATE reservations SET status = ?, decided_at = NOW() WHERE id = ?`,
      [decision, req.params.id],
    );

    // Create a notification for the student
    const dateStr = new Date(reservation.reserved_date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const title = decision === 'approved'
      ? 'Reservation Approved'
      : 'Reservation Rejected';
    const message = decision === 'approved'
      ? `Your reservation for ${reservation.lab} PC #${reservation.pc_number} on ${dateStr} has been approved.`
      : `Your reservation for ${reservation.lab} PC #${reservation.pc_number} on ${dateStr} has been rejected.`;

    await pool.query(
      `INSERT INTO notifications (id_number, type, title, message)
       VALUES (?, 'reservation', ?, ?)`,
      [reservation.id_number, title, message],
    );

    return res.status(200).json({ message: `Reservation ${decision}.` });
  } catch (err) {
    console.error('Decide reservation error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── ADMIN: TOGGLE PC BLOCK ───────────────────────────────────
// POST /api/reservations/admin/block  body: { lab, pc_number, date, blocked: true|false }
router.post('/admin/block', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only.' });
  }

  const { lab, pc_number, date, blocked } = req.body;

  if (!lab || !pc_number || !date) {
    return res.status(400).json({ message: 'Lab, PC number, and date are required.' });
  }

  try {
    if (blocked) {
      await pool.query(
        `INSERT IGNORE INTO admin_pc_blocks (lab, pc_number, blocked_date)
         VALUES (?, ?, ?)`,
        [lab, pc_number, date],
      );
    } else {
      await pool.query(
        `DELETE FROM admin_pc_blocks WHERE lab = ? AND pc_number = ? AND blocked_date = ?`,
        [lab, pc_number, date],
      );
    }

    return res.status(200).json({ message: blocked ? 'PC blocked.' : 'PC unblocked.' });
  } catch (err) {
    console.error('Toggle PC block error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
