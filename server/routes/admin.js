const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');
const { awardPoints } = require('../services/points');

// PH academic semester window (Asia/Manila). Returns {start, end} as UTC Date objects.
function getSemesterWindow(semester) {
  const now = new Date();
  const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const m = pht.getUTCMonth() + 1;
  const y = pht.getUTCFullYear();
  let label, startY, startM, endY, endM;
  if (semester === '1st' || (!semester && m >= 8 && m <= 12)) {
    label = '1st'; startY = y; startM = 8; endY = y; endM = 12;
    if (semester === '1st' && m < 8) { startY -= 1; endY -= 1; }
  } else if (semester === '2nd' || (!semester && m >= 1 && m <= 5)) {
    label = '2nd'; startY = y; startM = 1; endY = y; endM = 5;
  } else {
    label = 'summer'; startY = y; startM = 6; endY = y; endM = 7;
  }
  // Convert PHT bounds to UTC
  const startPHT = new Date(Date.UTC(startY, startM - 1, 1, 0, 0, 0));
  const endPHT = new Date(Date.UTC(endY, endM, 1, 0, 0, 0)); // first day of month after end
  const start = new Date(startPHT.getTime() - 8 * 60 * 60 * 1000);
  const end = new Date(endPHT.getTime() - 8 * 60 * 60 * 1000);
  return { label, start, end };
}

// Middleware: admin only
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Admin access only.' });
  next();
};

// Helper: get 10 PM PHT cutoff in UTC for daily reset
function getDailyCutoffUTC() {
  const now = new Date();
  const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const cutoff = new Date(pht);
  cutoff.setUTCHours(22, 0, 0, 0);
  if (pht.getUTCHours() < 22) cutoff.setUTCDate(cutoff.getUTCDate() - 1);
  return new Date(cutoff.getTime() - 8 * 60 * 60 * 1000);
}

// ── DASHBOARD STATS ───────────────────────────────────────────
// GET /api/admin/stats
router.get('/stats', verifyToken, adminOnly, async (req, res) => {
  try {
    await promoteDueReservations();
    const [[{ total_students }]] = await pool.query(
      `SELECT COUNT(*) as total_students FROM users WHERE role = 'student'`,
    );
    const [[{ currently_sitin }]] = await pool.query(
      `SELECT COUNT(*) as currently_sitin FROM sit_in_sessions WHERE status = 'active'`,
    );
    // Total sit-in resets daily at 10 PM PHT
    const [[{ total_sitin }]] = await pool.query(
      `SELECT COUNT(*) as total_sitin FROM sit_in_sessions
       WHERE status = 'completed' AND created_at >= ?`,
      [getDailyCutoffUTC()],
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

// Convert approved reservations whose time window is currently active
// into live sit-in sessions, so they appear in the Current Sit-in tab.
// Idempotent: skips students with an existing active session and skips
// reservations that were already promoted (matched on lab + pc + date).
async function promoteDueReservations() {
  try {
    await pool.query(
      `INSERT INTO sit_in_sessions
         (id_number, student_name, purpose, lab, pc_number, status, last_heartbeat, created_at)
       SELECT r.id_number, r.student_name, 'Reservation', r.lab, r.pc_number,
              'active', NOW(),
              TIMESTAMP(r.reserved_date, r.start_time)
       FROM reservations r
       WHERE r.status = 'approved'
         AND TIMESTAMP(r.reserved_date, r.start_time) <= NOW()
         AND TIMESTAMP(r.reserved_date, r.end_time)   >  NOW()
         AND NOT EXISTS (
           SELECT 1 FROM sit_in_sessions s
           WHERE s.id_number = r.id_number AND s.status = 'active'
         )
         AND NOT EXISTS (
           SELECT 1 FROM sit_in_sessions s
           WHERE s.id_number = r.id_number
             AND s.lab = r.lab
             AND s.pc_number = r.pc_number
             AND DATE(s.created_at) = r.reserved_date
         )`,
    );
  } catch (err) {
    console.error('promoteDueReservations error:', err);
  }
}

// ── SIT-IN RECORDS ────────────────────────────────────────────
// GET /api/admin/records
router.get('/records', verifyToken, adminOnly, async (req, res) => {
  try {
    await promoteDueReservations();
    const [rows] = await pool.query(
      `SELECT s.*, u.course, u.course_level, u.remaining_sessions
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
          (SELECT COUNT(*) FROM sit_in_sessions WHERE status = 'completed' AND created_at >= '${getDailyCutoffUTC().toISOString().slice(0,19).replace('T',' ')}') as total_sitin`,
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

// ── SIT-IN REPORTS (completed only) ──────────────────────────
// GET /api/admin/reports
router.get('/reports', verifyToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.id_number, s.student_name, s.purpose, s.lab,
              s.created_at AS login_time, s.ended_at AS logout_time,
              TIMESTAMPDIFF(MINUTE, s.created_at, s.ended_at) AS duration_minutes,
              DATE(s.created_at) AS session_date
       FROM sit_in_sessions s
       WHERE s.status = 'completed'
       ORDER BY s.created_at DESC`,
    );
    return res.status(200).json({ reports: rows });
  } catch (err) {
    console.error('Reports error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── FEEDBACK REPORTS ─────────────────────────────────────────
// GET /api/admin/feedback
router.get('/feedback', verifyToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.id, f.id_number, CONCAT(u.first_name, ' ', u.last_name) AS student_name,
              f.lab, f.rating, f.message, f.created_at,
              u.course
       FROM feedback f
       JOIN users u ON f.id_number = u.id_number
       ORDER BY f.created_at DESC`,
    );
    return res.status(200).json({ feedback: rows });
  } catch (err) {
    console.error('Feedback reports error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── END SIT-IN (Admin logout student) ────────────────────────
// POST /api/admin/sitin/:id/end
router.post('/sitin/:id/end', verifyToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, id_number FROM sit_in_sessions WHERE id = ? AND status = 'active'`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'No active session found.' });

    await pool.query(
      `UPDATE sit_in_sessions SET status = 'completed', ended_at = NOW() WHERE id = ?`,
      [req.params.id],
    );

    await pool.query(
      `UPDATE users SET remaining_sessions = remaining_sessions - 1
       WHERE id_number = ? AND remaining_sessions > 0`,
      [rows[0].id_number],
    );

    return res.status(200).json({ message: 'Student logged out successfully.' });
  } catch (err) {
    console.error('Admin end sit-in error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── LOOKUP STUDENT BY ID ─────────────────────────────────────
// GET /api/admin/students/:id_number/lookup
router.get(
  '/students/:id_number/lookup',
  verifyToken,
  adminOnly,
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT id_number, first_name, last_name, middle_name, course, course_level, remaining_sessions
         FROM users WHERE id_number = ? AND role = 'student'`,
        [req.params.id_number],
      );
      if (rows.length === 0)
        return res.status(404).json({ message: 'Student not found.' });

      // Check if student already has an active session
      const [active] = await pool.query(
        `SELECT id FROM sit_in_sessions WHERE id_number = ? AND status = 'active'`,
        [req.params.id_number],
      );

      const student = rows[0];
      student.has_active_session = active.length > 0;

      return res.status(200).json({ student });
    } catch (err) {
      console.error('Lookup student error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  },
);

// ── ADMIN START SIT-IN ───────────────────────────────────────
// POST /api/admin/sitin
router.post('/sitin', verifyToken, adminOnly, async (req, res) => {
  const { id_number, purpose, lab } = req.body;

  if (!id_number || !purpose || !lab)
    return res
      .status(400)
      .json({ message: 'ID number, purpose, and lab are required.' });

  try {
    // Verify student exists
    const [userRows] = await pool.query(
      `SELECT id_number, first_name, last_name, remaining_sessions
       FROM users WHERE id_number = ? AND role = 'student'`,
      [id_number],
    );
    if (userRows.length === 0)
      return res.status(404).json({ message: 'Student not found.' });

    const student = userRows[0];

    if (student.remaining_sessions <= 0)
      return res
        .status(400)
        .json({ message: 'Student has no remaining sessions.' });

    // Check for existing active session
    const [active] = await pool.query(
      `SELECT id FROM sit_in_sessions WHERE id_number = ? AND status = 'active'`,
      [id_number],
    );
    if (active.length > 0)
      return res
        .status(409)
        .json({ message: 'Student already has an active sit-in session.' });

    const student_name = `${student.first_name} ${student.last_name}`;

    await pool.query(
      `INSERT INTO sit_in_sessions (id_number, student_name, purpose, lab, status, last_heartbeat)
       VALUES (?, ?, ?, ?, 'active', NOW())`,
      [id_number, student_name, purpose, lab],
    );

    return res
      .status(201)
      .json({ message: `Sit-in started for ${student_name}.` });
  } catch (err) {
    console.error('Admin start sit-in error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── AWARD POINTS (admin manual) ──────────────────────────────
// POST /api/admin/students/:id_number/award-points  { delta, reason }
router.post('/students/:id_number/award-points', verifyToken, adminOnly, async (req, res) => {
  const { id_number } = req.params;
  const delta = parseInt(req.body.delta, 10);
  const reason = (req.body.reason || 'admin award').toString().slice(0, 255);

  if (!Number.isInteger(delta) || delta === 0) {
    return res.status(400).json({ message: 'delta must be a non-zero integer.' });
  }

  try {
    const [[u]] = await pool.query('SELECT id_number FROM users WHERE id_number = ? AND role = "student"', [id_number]);
    if (!u) return res.status(404).json({ message: 'Student not found.' });

    const award = await awardPoints(id_number, delta, reason);
    const [[row]] = await pool.query(
      'SELECT reward_points, remaining_sessions FROM users WHERE id_number = ?',
      [id_number],
    );
    return res.status(200).json({
      message: 'Points awarded.',
      reward_points: row.reward_points,
      remaining_sessions: row.remaining_sessions,
      redemptions: award.redemptions,
    });
  } catch (err) {
    console.error('Award points error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── LEADERBOARD ──────────────────────────────────────────────
// GET /api/admin/leaderboard?semester=current|1st|2nd|summer
router.get('/leaderboard', verifyToken, adminOnly, async (req, res) => {
  try {
    const semParam = req.query.semester && req.query.semester !== 'current' ? req.query.semester : null;
    const { label, start, end } = getSemesterWindow(semParam);

    const [rows] = await pool.query(
      `SELECT u.id_number, u.first_name, u.last_name, u.profile_image,
              u.reward_points AS current_balance,
              COALESCE(p.earned_points, 0) AS earned_points,
              COALESCE(s.total_seconds, 0) AS total_seconds,
              COALESCE(s.tasks_completed, 0) AS tasks_completed
       FROM users u
       LEFT JOIN (
         SELECT id_number, SUM(delta) AS earned_points
         FROM point_history
         WHERE delta > 0 AND created_at >= ? AND created_at < ?
         GROUP BY id_number
       ) p ON p.id_number = u.id_number
       LEFT JOIN (
         SELECT id_number,
                SUM(TIMESTAMPDIFF(SECOND, created_at, ended_at)) AS total_seconds,
                COUNT(*) AS tasks_completed
         FROM sit_in_sessions
         WHERE status = 'completed'
           AND ended_at IS NOT NULL
           AND created_at >= ? AND created_at < ?
         GROUP BY id_number
       ) s ON s.id_number = u.id_number
       WHERE u.role = 'student'`,
      [start, end, start, end],
    );

    const scored = rows
      .map(r => {
        const earned = Number(r.earned_points) || 0;
        const hours = +(((Number(r.total_seconds) || 0) / 3600).toFixed(2));
        const tasks = Number(r.tasks_completed) || 0;
        const score = 0.5 * earned + 0.3 * hours + 0.2 * tasks;
        return {
          id_number: r.id_number,
          name: `${r.first_name} ${r.last_name}`.trim(),
          profile_image: r.profile_image,
          earned_points: earned,
          current_balance: Number(r.current_balance) || 0,
          total_hours: hours,
          tasks_completed: tasks,
          score: +score.toFixed(2),
        };
      })
      .filter(r => r.earned_points > 0 || r.total_hours > 0 || r.tasks_completed > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((r, i) => ({ rank: i + 1, ...r }));

    return res.status(200).json({
      semester: label,
      window: { start, end },
      leaderboard: scored,
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

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
          (SELECT COUNT(*) FROM sit_in_sessions WHERE status = 'completed' AND created_at >= '${getDailyCutoffUTC().toISOString().slice(0,19).replace('T',' ')}') as total_sitin`,
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
