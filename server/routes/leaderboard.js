const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// PH academic semester window — mirrors admin.js.
function getSemesterWindow() {
  const now = new Date();
  const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const m = pht.getUTCMonth() + 1;
  const y = pht.getUTCFullYear();
  let label, startY, startM, endY, endM;
  if (m >= 8 && m <= 12) {
    label = '1st'; startY = y; startM = 8; endY = y; endM = 12;
  } else if (m >= 1 && m <= 5) {
    label = '2nd'; startY = y; startM = 1; endY = y; endM = 5;
  } else {
    label = 'summer'; startY = y; startM = 6; endY = y; endM = 7;
  }
  const startPHT = new Date(Date.UTC(startY, startM - 1, 1, 0, 0, 0));
  const endPHT = new Date(Date.UTC(endY, endM, 1, 0, 0, 0));
  const start = new Date(startPHT.getTime() - 8 * 60 * 60 * 1000);
  const end = new Date(endPHT.getTime() - 8 * 60 * 60 * 1000);
  return { label, start, end };
}

// GET /api/leaderboard/public-top — top 3 of current semester. No auth.
router.get('/public-top', async (req, res) => {
  try {
    const { label, start, end } = getSemesterWindow();

    const [rows] = await pool.query(
      `SELECT u.id_number, u.first_name, u.last_name, u.profile_image,
              COALESCE(p.earned_points, 0)  AS earned_points,
              COALESCE(s.total_seconds, 0)  AS total_seconds,
              COALESCE(s.tasks_completed,0) AS tasks_completed
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
         WHERE status = 'completed' AND ended_at IS NOT NULL
           AND created_at >= ? AND created_at < ?
         GROUP BY id_number
       ) s ON s.id_number = u.id_number
       WHERE u.role = 'student'`,
      [start, end, start, end],
    );

    const maxP = Math.max(1, ...rows.map(r => Number(r.earned_points) || 0));
    const maxH = Math.max(1, ...rows.map(r => Number(r.total_seconds) || 0));
    const maxT = Math.max(1, ...rows.map(r => Number(r.tasks_completed) || 0));

    const top = rows
      .map(r => {
        const earned = Number(r.earned_points) || 0;
        const seconds = Number(r.total_seconds) || 0;
        const tasks = Number(r.tasks_completed) || 0;
        const score = 0.5 * (earned / maxP) + 0.3 * (seconds / maxH) + 0.2 * (tasks / maxT);
        const lastInitial = (r.last_name || '').trim().charAt(0).toUpperCase();
        return {
          name: `${r.first_name} ${lastInitial}${lastInitial ? '.' : ''}`.trim(),
          profile_image: r.profile_image,
          score: +(score * 100).toFixed(1),
        };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((r, i) => ({ rank: i + 1, ...r }));

    return res.status(200).json({ semester: label, top });
  } catch (err) {
    console.error('Public leaderboard error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
