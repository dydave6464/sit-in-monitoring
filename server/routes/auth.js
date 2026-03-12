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

  // Validate ID number: must be exactly 8 digits
  if (!/^\d{8}$/.test(id_number)) {
    return res.status(400).json({
      field: 'id_number',
      message: 'ID Number must be exactly 8 digits.',
    });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({
      field: 'password',
      message: 'Password must be at least 6 characters.',
    });
  }

  try {
    // Check if ID already exists
    const [existing] = await pool.query(
      'SELECT id_number FROM users WHERE id_number = ?',
      [id_number],
    );
    if (existing.length > 0) {
      return res.status(409).json({
        field: 'id_number',
        message: 'ID Number is already registered.',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    await pool.query(
      `INSERT INTO users (id_number, last_name, first_name, middle_name, course_level, password, email, course, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
router.post('/login', async (req, res) => {
  const { id_number, password } = req.body;

  // Validate ID number format
  if (!/^\d{8}$/.test(id_number)) {
    return res.status(400).json({
      field: 'id_number',
      message: 'ID Number must be exactly 8 digits.',
    });
  }

  if (!password) {
    return res
      .status(400)
      .json({ field: 'password', message: 'Password is required.' });
  }

  try {
    // Find user by ID
    const [rows] = await pool.query('SELECT * FROM users WHERE id_number = ?', [
      id_number,
    ]);

    if (rows.length === 0) {
      return res.status(401).json({
        field: 'id_number',
        message: 'Incorrect ID Number or Password.',
      });
    }

    const user = rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        field: 'password',
        message: 'Incorrect ID Number or Password.',
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id_number, first_name: user.first_name },
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
        course: user.course,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

module.exports = router;
