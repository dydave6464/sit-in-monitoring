const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool = require('../config/db');
require('dotenv').config();

// ── EMAIL TRANSPORT ──────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ── OTP STORE (in-memory, keyed by email) ────────────────────
// { email: { code, expires, id_number } }
const otpStore = new Map();

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── FORGOT PASSWORD: SEND OTP ────────────────────────────────
// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.trim())
    return res.status(400).json({ message: 'Email is required.' });

  try {
    const [rows] = await pool.query(
      'SELECT id_number, first_name, email FROM users WHERE email = ?',
      [email.trim().toLowerCase()],
    );

    if (rows.length === 0)
      return res.status(404).json({ message: 'No account found with that email.' });

    const user = rows[0];
    const code = generateOTP();
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(email.trim().toLowerCase(), {
      code,
      expires,
      id_number: user.id_number,
    });

    await transporter.sendMail({
      from: `"CCS Sit-in Monitoring" <${process.env.MAIL_USER}>`,
      to: email.trim(),
      subject: 'Password Reset Code',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:24px;">
          <h2 style="color:#1f4f94;margin-bottom:8px;">Password Reset</h2>
          <p>Hi ${user.first_name},</p>
          <p>Your verification code is:</p>
          <div style="background:#f0f4fb;border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
            <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1f4f94;">${code}</span>
          </div>
          <p style="color:#666;font-size:13px;">This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({ message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ message: 'Failed to send email. Try again later.' });
  }
});

// ── FORGOT PASSWORD: VERIFY OTP ──────────────────────────────
// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
  const { email, code } = req.body;

  if (!email || !code)
    return res.status(400).json({ message: 'Email and code are required.' });

  const key = email.trim().toLowerCase();
  const entry = otpStore.get(key);

  if (!entry)
    return res.status(400).json({ message: 'No OTP found. Please request a new code.' });

  if (Date.now() > entry.expires) {
    otpStore.delete(key);
    return res.status(400).json({ message: 'Code has expired. Please request a new one.' });
  }

  if (entry.code !== code.trim())
    return res.status(400).json({ message: 'Invalid code. Please try again.' });

  // Mark as verified (keep entry for reset step)
  entry.verified = true;

  return res.status(200).json({ message: 'Code verified.' });
});

// ── FORGOT PASSWORD: RESET PASSWORD ─────────────────────────
// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { email, new_password } = req.body;

  if (!email || !new_password)
    return res.status(400).json({ message: 'Email and new password are required.' });

  if (new_password.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });

  const key = email.trim().toLowerCase();
  const entry = otpStore.get(key);

  if (!entry || !entry.verified)
    return res.status(400).json({ message: 'Please verify your code first.' });

  try {
    // Check if new password is the same as the old one
    const [rows] = await pool.query(
      'SELECT password FROM users WHERE id_number = ?',
      [entry.id_number],
    );
    if (rows.length > 0) {
      const isSame = await bcrypt.compare(new_password, rows[0].password);
      if (isSame) {
        return res.status(400).json({ message: 'New password cannot be the same as your current password.' });
      }
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id_number = ?', [
      hashed,
      entry.id_number,
    ]);

    otpStore.delete(key);

    return res.status(200).json({ message: 'Password reset successfully!' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

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
