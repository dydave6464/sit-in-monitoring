const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');

// ── GET ALL ANNOUNCEMENTS ─────────────────────────────────────
// GET /api/announcements  (public — shown on login page)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM announcements ORDER BY created_at DESC',
    );
    return res.status(200).json({ announcements: rows });
  } catch (err) {
    console.error('Get announcements error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── CREATE ANNOUNCEMENT (admin only) ─────────────────────────
// POST /api/announcements
router.post('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Admin access only.' });

  const { title, body } = req.body;
  if (!title || !body)
    return res.status(400).json({ message: 'Title and body are required.' });

  try {
    const [result] = await pool.query(
      'INSERT INTO announcements (title, body) VALUES (?, ?)',
      [title, body],
    );
    const [rows] = await pool.query(
      'SELECT * FROM announcements WHERE id = ?',
      [result.insertId],
    );
    return res.status(201).json({ announcement: rows[0] });
  } catch (err) {
    console.error('Create announcement error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── DELETE ANNOUNCEMENT (admin only) ─────────────────────────
// DELETE /api/announcements/:id
router.delete('/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Admin access only.' });

  try {
    await pool.query('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    return res.status(200).json({ message: 'Announcement deleted.' });
  } catch (err) {
    console.error('Delete announcement error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
