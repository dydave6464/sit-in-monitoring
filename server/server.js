const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── ROUTES ────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Example of a protected route using verifyToken middleware:
// const verifyToken = require('./middleware/auth');
// const userRoutes = require('./routes/user');
// app.use('/api/user', verifyToken, userRoutes);

// ── START SERVER ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
