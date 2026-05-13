const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');

const PRESET = ['Visual Studio Code', 'Visual Studio', 'CISCO', 'VMWare', 'VirtualBox', 'XAMPP'];
const LABS = ['Lab 524', 'Lab 526', 'Lab 528', 'Lab 530', 'Lab 542'];

// GET /api/lab-software/presets — returns preset software + lab list
router.get('/presets', verifyToken, (req, res) => {
  return res.status(200).json({ software: PRESET, labs: LABS });
});

// GET /api/lab-software/:lab — list software installed in a lab
router.get('/:lab', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, software_name, version, notes FROM lab_software WHERE lab = ? ORDER BY software_name',
      [req.params.lab],
    );
    return res.status(200).json({ lab: req.params.lab, software: rows });
  } catch (err) {
    console.error('Lab software list error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/lab-software/:lab — admin: replace lab's full software set
// body: { software: [{ software_name, version?, notes? }, ...] }
router.put('/:lab', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only.' });
  }
  const { lab } = req.params;
  const list = Array.isArray(req.body.software) ? req.body.software : [];

  // De-dupe by software_name (case-insensitive), trim, drop empties
  const seen = new Set();
  const cleaned = [];
  for (const entry of list) {
    const name = (entry?.software_name || '').toString().trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({
      software_name: name.slice(0, 120),
      version: (entry.version || '').toString().trim().slice(0, 60) || null,
      notes: (entry.notes || '').toString().trim().slice(0, 255) || null,
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM lab_software WHERE lab = ?', [lab]);
    for (const s of cleaned) {
      await conn.query(
        'INSERT INTO lab_software (lab, software_name, version, notes) VALUES (?, ?, ?, ?)',
        [lab, s.software_name, s.version, s.notes],
      );
    }
    await conn.commit();
    return res.status(200).json({ lab, count: cleaned.length });
  } catch (err) {
    await conn.rollback();
    console.error('Lab software save error:', err);
    return res.status(500).json({ message: 'Server error.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
