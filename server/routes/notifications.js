const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');

// ── GET MY NOTIFICATIONS ─────────────────────────────────────
// GET /api/notifications
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, type, title, message, reservation_id, is_read, created_at
       FROM notifications
       WHERE id_number = ?
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.user.id],
    );

    return res.status(200).json({ notifications: rows });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET UNREAD COUNT ─────────────────────────────────────────
// GET /api/notifications/unread-count
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS count FROM notifications
       WHERE id_number = ? AND is_read = FALSE`,
      [req.user.id],
    );
    return res.status(200).json({ count: row.count });
  } catch (err) {
    console.error('Unread count error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── MARK NOTIFICATION READ ───────────────────────────────────
// POST /api/notifications/:id/read
router.post('/:id/read', verifyToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE id = ? AND id_number = ?`,
      [req.params.id, req.user.id],
    );
    return res.status(200).json({ message: 'Marked as read.' });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── MARK ALL READ ────────────────────────────────────────────
// POST /api/notifications/read-all
router.post('/read-all', verifyToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE id_number = ? AND is_read = FALSE`,
      [req.user.id],
    );
    return res.status(200).json({ message: 'All marked as read.' });
  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
