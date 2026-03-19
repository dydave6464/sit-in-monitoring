const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');

// Middleware: admin only
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Admin access only.' });
  next();
};

// ── DASHBOARD STATS ───────────────────────────────────────────
// GET /api/admin/stats
router.get('/stats', verifyToken, adminOnly, async (req, res) => {
  try {
    const [[{ total_students }]] = await pool.query(
      `SELECT COUNT(*) as total_students FROM users WHERE role = 'student'`,
    );
    const [[{ currently_sitin }]] = await pool.query(
      `SELECT COUNT(*) as currently_sitin FROM sit_in_sessions WHERE status = 'active'`,
    );
    const [[{ total_sitin }]] = await pool.query(
      `SELECT COUNT(*) as total_sitin FROM sit_in_sessions WHERE status = 'completed'`,
    );

    return res
      .status(200)
      .json({ total_students, currently_sitin, total_sitin });
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── STUDENT LIST ──────────────────────────────────────────────
// GET /api/admin/students
router.get('/students', verifyToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id_number, first_name, last_name, course, course_level, remaining_sessions, created_at
       FROM users WHERE role = 'student' ORDER BY created_at DESC`,
    );
    return res.status(200).json({ students: rows });
  } catch (err) {
    console.error('Students error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── EDIT STUDENT SESSIONS ─────────────────────────────────────
// PUT /api/admin/students/:id_number/sessions
router.put(
  '/students/:id_number/sessions',
  verifyToken,
  adminOnly,
  async (req, res) => {
    const { remaining_sessions } = req.body;
    try {
      await pool.query(
        'UPDATE users SET remaining_sessions = ? WHERE id_number = ?',
        [remaining_sessions, req.params.id_number],
      );
      return res.status(200).json({ message: 'Sessions updated.' });
    } catch (err) {
      console.error('Update sessions error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  },
);

// ── SIT-IN RECORDS ────────────────────────────────────────────
// GET /api/admin/records
router.get('/records', verifyToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, u.course, u.course_level
       FROM sit_in_sessions s
       JOIN users u ON s.id_number = u.id_number
       ORDER BY s.created_at DESC`,
    );
    return res.status(200).json({ records: rows });
  } catch (err) {
    console.error('Records error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── ACTIVE SIT-INS (for SSE) ──────────────────────────────────
// GET /api/admin/active
router.get('/active', verifyToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, u.course, u.course_level
       FROM sit_in_sessions s
       JOIN users u ON s.id_number = u.id_number
       WHERE s.status = 'active'
       ORDER BY s.created_at DESC`,
    );
    return res.status(200).json({ active: rows });
  } catch (err) {
    console.error('Active sit-ins error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── SERVER-SENT EVENTS ────────────────────────────────────────
// GET /api/admin/sse
// Admin dashboard subscribes to this for live updates
router.get('/sse', verifyToken, adminOnly, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendUpdate = async () => {
    try {
      const [active] = await pool.query(
        `SELECT s.*, u.course, u.course_level
         FROM sit_in_sessions s
         JOIN users u ON s.id_number = u.id_number
         WHERE s.status = 'active'
         ORDER BY s.created_at DESC`,
      );
      const [[stats]] = await pool.query(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE role = 'student') as total_students,
          (SELECT COUNT(*) FROM sit_in_sessions WHERE status = 'active') as currently_sitin,
          (SELECT COUNT(*) FROM sit_in_sessions WHERE status = 'completed') as total_sitin`,
      );
      res.write(`data: ${JSON.stringify({ active, stats })}\n\n`);
    } catch (err) {
      console.error('SSE error:', err);
    }
  };

  // Send immediately on connect
  sendUpdate();

  // Then every 5 seconds
  const interval = setInterval(sendUpdate, 5000);

  // Cleanup when client disconnects
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// DELETE STUDENT
router.delete(
  '/students/:id_number',
  verifyToken,
  adminOnly,
  async (req, res) => {
    try {
      await pool.query('DELETE FROM sit_in_sessions WHERE id_number = ?', [
        req.params.id_number,
      ]);
      await pool.query('DELETE FROM users WHERE id_number = ?', [
        req.params.id_number,
      ]);
      return res.status(200).json({ message: 'Student deleted.' });
    } catch (err) {
      console.error('Delete student error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  },
);

module.exports = router;

// ── SSE (open — token via query param for EventSource) ────────
// GET /api/admin/sse-open?token=xxx
router.get('/sse-open', async (req, res) => {
  const jwt = require('jsonwebtoken');
  const token = req.query.token;
  if (!token) return res.status(401).end();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).end();
  } catch (err) {
    return res.status(403).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendUpdate = async () => {
    try {
      const [active] = await pool.query(
        `SELECT s.*, u.course, u.course_level
         FROM sit_in_sessions s
         JOIN users u ON s.id_number = u.id_number
         WHERE s.status = 'active'
         ORDER BY s.created_at DESC`,
      );
      const [[stats]] = await pool.query(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE role = 'student') as total_students,
          (SELECT COUNT(*) FROM sit_in_sessions WHERE status = 'active') as currently_sitin,
          (SELECT COUNT(*) FROM sit_in_sessions WHERE status = 'completed') as total_sitin`,
      );
      res.write(`data: ${JSON.stringify({ active, stats })}\n\n`);
    } catch (err) {
      console.error('SSE error:', err);
    }
  };

  sendUpdate();
  const interval = setInterval(sendUpdate, 5000);
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});
