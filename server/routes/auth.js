const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

// ── REGISTER ─────────────────────────────────────────────────
// POST /api/auth/register
router.post('/register', async (req, res) => {
  const {
    id_number,
    last_name,
    first_name,
    middle_name,
    course_level,
    password,
    email,
    course,
    address,
  } = req.body;

  if (!/^\d{8}$/.test(id_number))
    return res
      .status(400)
      .json({
        field: 'id_number',
        message: 'ID Number must be exactly 8 digits.',
      });

  if (!password || password.length < 6)
    return res
      .status(400)
      .json({
        field: 'password',
        message: 'Password must be at least 6 characters.',
      });

  try {
    const [existing] = await pool.query(
      'SELECT id_number FROM users WHERE id_number = ?',
      [id_number],
    );
    if (existing.length > 0)
      return res
        .status(409)
        .json({
          field: 'id_number',
          message: 'ID Number is already registered.',
        });

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users 
        (id_number, last_name, first_name, middle_name, course_level, password, email, course, address, role, remaining_sessions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'student', 30)`,
      [
        id_number,
        last_name,
        first_name,
        middle_name,
        course_level,
        hashedPassword,
        email,
        course,
        address,
      ],
    );

    return res.status(201).json({ message: 'Registration successful!' });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────
// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { id_number, password } = req.body;

  if (!/^\d{8}$/.test(id_number))
    return res
      .status(400)
      .json({
        field: 'id_number',
        message: 'ID Number must be exactly 8 digits.',
      });

  if (!password)
    return res
      .status(400)
      .json({ field: 'password', message: 'Password is required.' });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id_number = ?', [
      id_number,
    ]);
    if (rows.length === 0)
      return res
        .status(401)
        .json({
          field: 'id_number',
          message: 'Incorrect ID Number or Password.',
        });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res
        .status(401)
        .json({
          field: 'password',
          message: 'Incorrect ID Number or Password.',
        });

    const token = jwt.sign(
      { id: user.id_number, first_name: user.first_name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    return res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id_number: user.id_number,
        first_name: user.first_name,
        last_name: user.last_name,
        middle_name: user.middle_name,
        course: user.course,
        course_level: user.course_level,
        email: user.email,
        address: user.address,
        remaining_sessions: user.remaining_sessions,
        role: user.role,
        profile_image: user.profile_image,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── MIDDLEWARE & UPLOAD ───────────────────────────────────────
const verifyToken = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, _file, cb) => {
    const ext = path.extname(_file.originalname).toLowerCase();
    cb(null, `avatar-${req.user.id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only .jpg, .png, .webp images are allowed.'));
  },
});

// ── GET PROFILE ──────────────────────────────────────────────
// GET /api/auth/profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id_number, first_name, last_name, middle_name,
              course, course_level, email, address, remaining_sessions, role, profile_image
       FROM users WHERE id_number = ?`,
      [req.user.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'User not found.' });

    return res.status(200).json({ user: rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── UPDATE PROFILE ───────────────────────────────────────────
// PUT /api/auth/profile
router.put('/profile', verifyToken, async (req, res) => {
  const { first_name, last_name, middle_name, course, course_level, email, address } = req.body;

  if (!first_name || !last_name)
    return res.status(400).json({ message: 'First and last name are required.' });

  try {
    await pool.query(
      `UPDATE users SET first_name = ?, last_name = ?, middle_name = ?,
              course = ?, course_level = ?, email = ?, address = ?
       WHERE id_number = ?`,
      [first_name, last_name, middle_name, course, course_level, email, address, req.user.id],
    );

    const [rows] = await pool.query(
      `SELECT id_number, first_name, last_name, middle_name,
              course, course_level, email, address, remaining_sessions, role, profile_image
       FROM users WHERE id_number = ?`,
      [req.user.id],
    );

    return res.status(200).json({ message: 'Profile updated.', user: rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── CHANGE PASSWORD ──────────────────────────────────────────
// PUT /api/auth/change-password
router.put('/change-password', verifyToken, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password)
    return res.status(400).json({ message: 'Both current and new password are required.' });

  if (new_password.length < 6)
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });

  try {
    const [rows] = await pool.query('SELECT password FROM users WHERE id_number = ?', [req.user.id]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(current_password, rows[0].password);
    if (!isMatch)
      return res.status(401).json({ message: 'Current password is incorrect.' });

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id_number = ?', [hashed, req.user.id]);

    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ── UPLOAD PROFILE IMAGE ─────────────────────────────────────
// POST /api/auth/profile/avatar
router.post('/profile/avatar', verifyToken, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError
        ? 'File too large. Max 2 MB.'
        : err.message;
      return res.status(400).json({ message: msg });
    }
    if (!req.file)
      return res.status(400).json({ message: 'No file uploaded.' });

    const imagePath = `/uploads/${req.file.filename}`;
    try {
      await pool.query('UPDATE users SET profile_image = ? WHERE id_number = ?', [
        imagePath,
        req.user.id,
      ]);
      return res.status(200).json({ message: 'Avatar updated.', profile_image: imagePath });
    } catch (e) {
      console.error('Avatar upload error:', e);
      return res.status(500).json({ message: 'Server error.' });
    }
  });
});

module.exports = router;
