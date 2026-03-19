
-- Command: mysql -u root -p < config/setup.sql


CREATE DATABASE IF NOT EXISTS sit_monitoring;
USE sit_monitoring;

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  id_number          CHAR(8) NOT NULL UNIQUE,
  last_name          VARCHAR(100) NOT NULL,
  first_name         VARCHAR(100) NOT NULL,
  middle_name        VARCHAR(100),
  course_level       TINYINT,
  password           VARCHAR(255) NOT NULL,
  email              VARCHAR(150),
  course             VARCHAR(150),
  address            VARCHAR(255),
  role               ENUM('student', 'admin') DEFAULT 'student',
  remaining_sessions INT DEFAULT 30,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── SIT-IN SESSIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sit_in_sessions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_number      CHAR(8) NOT NULL,
  student_name   VARCHAR(255) NOT NULL,
  purpose        VARCHAR(255) NOT NULL,
  lab            VARCHAR(100) NOT NULL,
  status         ENUM('active', 'completed', 'abandoned') DEFAULT 'active',
  last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at       DATETIME DEFAULT NULL,
  FOREIGN KEY (id_number) REFERENCES users(id_number)
);

-- ── ANNOUNCEMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── DEFAULT ADMIN ACCOUNT ────────────────────────────────────
-- Password: admin123 — change after first login
INSERT INTO users (id_number, last_name, first_name, middle_name, password, role, remaining_sessions)
VALUES (
  '00000000',
  'Admin',
  'CCS',
  '',
  '$2a$10$aRoZPcDZwVxWCPXZrPjKhOyb9RAbLNwsz.GO43HRtottz26/KQkSu',
  'admin',
  0
) ON DUPLICATE KEY UPDATE role = 'admin';

-- ── SAMPLE ANNOUNCEMENTS ─────────────────────────────────────
INSERT INTO announcements (title, body) VALUES
  ('New Sit-in Monitoring Process', 'Starting this semester, all sit-in sessions must be logged through the CCS Monitoring System. Walk-in requests without prior registration will no longer be accommodated.'),
  ('Lab Schedule Update for AY 2025-2026', 'Laboratory schedules for the second semester have been updated. Students are advised to check their assigned lab rooms before their sit-in sessions.'),
  ('Sit-in Hour Limits Reminder', 'Each student is allowed a maximum of 30 sit-in sessions per semester. Students who exceed the limit will need to coordinate with the lab-in-charge for special approval.');