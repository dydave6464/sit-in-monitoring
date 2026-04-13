const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── ROUTES ────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sitin', require('./routes/sitin'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/announcements', require('./routes/announcement'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/notifications', require('./routes/notifications'));

// ── HEALTH CHECK ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running.' });
});

// ── START ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
