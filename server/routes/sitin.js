const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');

// ── START SIT-IN ──────────────────────────────────────────────
// POST /api/sitin/start  (student only)
router.post('/start', verifyToken, async (req, res) => {
  if (req.user.role !== 'student')
    return res
      .status(403)
      .json({ message: 'Only students can start a sit-in.' });

  const { purpose, lab } = req.body;
  const id_number = req.user.id;

  if (!purpose || !lab)
    return res.status(400).json({ message: 'Purpose and lab are required.' });

  try {
    // Check if student already has an active session
    const [active] = await pool.query(
      `SELECT id FROM sit_in_sessions WHERE id_number = ? AND status = 'active'`,
      [id_number],
    );
    if (active.length > 0)
      return res
        .status(409)
        .json({ message: 'You already have an active sit-in session.' });

    // Check remaining sessions
    const [userRows] = await pool.query(
      'SELECT remaining_sessions, first_name, last_name FROM users WHERE id_number = ?',
      [id_number],
    );
    const user = userRows[0];

    if (user.remaining_sessions <= 0)
      return res
        .status(400)
        .json({ message: 'You have no remaining sessions left.' });

    const student_name = `${user.first_name} ${user.last_name}`;

    // Create sit-in session
    const [result] = await pool.query(
      `INSERT INTO sit_in_sessions (id_number, student_name, purpose, lab, status, last_heartbeat)
       VALUES (?, ?, ?, ?, 'active', NOW())`,
      [id_number, student_name, purpose, lab],
    );

    const [session] = await pool.query(
      'SELECT * FROM sit_in_sessions WHERE id = ?',
      [result.insertId],
    );

    return res.status(201).json({
      message: 'Sit-in started successfully.',
      session: session[0],
      remaining_sessions: user.remaining_sessions,
    });
  } catch (err) {
    console.error('Start sit-in error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── HEARTBEAT ─────────────────────────────────────────────────
// POST /api/sitin/heartbeat  (called every 30s from student browser)
router.post('/heartbeat', verifyToken, async (req, res) => {
  if (req.user.role !== 'student')
    return res.status(403).json({ message: 'Forbidden.' });

  try {
    await pool.query(
      `UPDATE sit_in_sessions SET last_heartbeat = NOW()
       WHERE id_number = ? AND status = 'active'`,
      [req.user.id],
    );
    return res.status(200).json({ message: 'Heartbeat received.' });
  } catch (err) {
    console.error('Heartbeat error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── END SIT-IN (LOGOUT) ───────────────────────────────────────
// POST /api/sitin/end  — decreases session by 1
router.post('/end', verifyToken, async (req, res) => {
  if (req.user.role !== 'student')
    return res.status(403).json({ message: 'Forbidden.' });

  const id_number = req.user.id;

  try {
    const [active] = await pool.query(
      `SELECT id FROM sit_in_sessions WHERE id_number = ? AND status = 'active'`,
      [id_number],
    );
    if (active.length === 0)
      return res
        .status(404)
        .json({ message: 'No active sit-in session found.' });

    // Mark session as completed
    await pool.query(
      `UPDATE sit_in_sessions SET status = 'completed', ended_at = NOW()
       WHERE id_number = ? AND status = 'active'`,
      [id_number],
    );

    // Decrease remaining sessions by 1
    await pool.query(
      `UPDATE users SET remaining_sessions = remaining_sessions - 1
       WHERE id_number = ? AND remaining_sessions > 0`,
      [id_number],
    );

    const [userRows] = await pool.query(
      'SELECT remaining_sessions FROM users WHERE id_number = ?',
      [id_number],
    );

    return res.status(200).json({
      message: 'Sit-in ended. Session deducted.',
      remaining_sessions: userRows[0].remaining_sessions,
    });
  } catch (err) {
    console.error('End sit-in error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── GET ACTIVE SESSION ────────────────────────────────────────
// GET /api/sitin/active  — check if student has active session
router.get('/active', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM sit_in_sessions WHERE id_number = ? AND status = 'active'`,
      [req.user.id],
    );
    return res.status(200).json({ session: rows[0] || null });
  } catch (err) {
    console.error('Get active session error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── MARK ABANDONED (background job) ──────────────────────────
// POST /api/sitin/mark-abandoned
// Call this on a schedule or on admin dashboard load
// Marks sessions with no heartbeat for 5+ minutes as abandoned
router.post('/mark-abandoned', async (req, res) => {
  try {
    await pool.query(
      `UPDATE sit_in_sessions
       SET status = 'abandoned'
       WHERE status = 'active'
       AND last_heartbeat < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
    );
    return res.status(200).json({ message: 'Abandoned sessions marked.' });
  } catch (err) {
    console.error('Mark abandoned error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
