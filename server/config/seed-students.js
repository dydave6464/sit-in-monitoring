/**
 * Seed 20 sample students with varied courses and sit-in sessions.
 *
 * Usage: npm run db:seed
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const students = [
  { id: '23833001', first: 'Maria', middle: 'Santos', last: 'Reyes', course: 'Information Technology', level: 3, email: 'maria.reyes@test.com', address: 'Cebu City' },
  { id: '23833002', first: 'Juan', middle: 'Dela', last: 'Cruz', course: 'Computer Engineering', level: 2, email: 'juan.cruz@test.com', address: 'Mandaue City' },
  { id: '23833003', first: 'Ana', middle: 'Marie', last: 'Garcia', course: 'Information Technology', level: 4, email: 'ana.garcia@test.com', address: 'Lapu-Lapu City' },
  { id: '23833004', first: 'Carlos', middle: '', last: 'Santos', course: 'Civil Engineering', level: 1, email: 'carlos.santos@test.com', address: 'Talisay City' },
  { id: '23833005', first: 'Rose', middle: 'Ann', last: 'Fernandez', course: 'Accountancy', level: 3, email: 'rose.fernandez@test.com', address: 'Cebu City' },
  { id: '23833006', first: 'Mark', middle: 'Joseph', last: 'Villanueva', course: 'Information Technology', level: 2, email: 'mark.villanueva@test.com', address: 'Minglanilla' },
  { id: '23833007', first: 'Jasmine', middle: '', last: 'Tan', course: 'Hotel and Restaurant Management', level: 4, email: 'jasmine.tan@test.com', address: 'Cebu City' },
  { id: '23833008', first: 'Kevin', middle: 'Ray', last: 'Mendoza', course: 'Mechanical Engineering', level: 1, email: 'kevin.mendoza@test.com', address: 'Consolacion' },
  { id: '23833009', first: 'Patricia', middle: 'Lyn', last: 'Bautista', course: 'Criminology', level: 3, email: 'patricia.bautista@test.com', address: 'Mandaue City' },
  { id: '23833010', first: 'Daniel', middle: '', last: 'Lim', course: 'Computer Engineering', level: 2, email: 'daniel.lim@test.com', address: 'Cebu City' },
  { id: '23833011', first: 'Grace', middle: 'Mae', last: 'Flores', course: 'Information Technology', level: 1, email: 'grace.flores@test.com', address: 'Talisay City' },
  { id: '23833012', first: 'Jerome', middle: '', last: 'Ramos', course: 'Electrical Engineering', level: 4, email: 'jerome.ramos@test.com', address: 'Lapu-Lapu City' },
  { id: '23833013', first: 'Andrea', middle: 'Joy', last: 'Castillo', course: 'Commerce', level: 2, email: 'andrea.castillo@test.com', address: 'Cebu City' },
  { id: '23833014', first: 'Rico', middle: 'James', last: 'Navarro', course: 'Information Technology', level: 3, email: 'rico.navarro@test.com', address: 'Minglanilla' },
  { id: '23833015', first: 'Samantha', middle: '', last: 'Aquino', course: 'Elementary Education (BEEd)', level: 1, email: 'samantha.aquino@test.com', address: 'Consolacion' },
  { id: '23833016', first: 'Bryan', middle: 'Lee', last: 'Torres', course: 'Industrial Engineering', level: 4, email: 'bryan.torres@test.com', address: 'Mandaue City' },
  { id: '23833017', first: 'Nicole', middle: '', last: 'De Leon', course: 'AB English', level: 2, email: 'nicole.deleon@test.com', address: 'Cebu City' },
  { id: '23833018', first: 'Ryan', middle: 'Patrick', last: 'Santiago', course: 'Information Technology', level: 3, email: 'ryan.santiago@test.com', address: 'Talisay City' },
  { id: '23833019', first: 'Cristina', middle: '', last: 'Morales', course: 'Customs Administration', level: 1, email: 'cristina.morales@test.com', address: 'Cebu City' },
  { id: '23833020', first: 'Aldrin', middle: 'Cruz', last: 'Padilla', course: 'Naval Architecture and Marine Engineering', level: 2, email: 'aldrin.padilla@test.com', address: 'Lapu-Lapu City' },
];

const purposes = ['C Programming', 'Java', 'Mobile Development', 'Web Development', 'Python', 'Database'];
const labs = ['Lab 524', 'Lab 526', 'Lab 528', 'Lab 530', 'Lab 542'];

async function seed() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
    });

    const hashedPassword = await bcrypt.hash('student123', 10);

    console.log('Seeding 20 students...');
    for (const s of students) {
      await conn.query(
        `INSERT INTO users (id_number, first_name, middle_name, last_name, course, course_level, password, email, address, role, remaining_sessions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'student', 30)
         ON DUPLICATE KEY UPDATE id_number = id_number`,
        [s.id, s.first, s.middle, s.last, s.course, s.level, hashedPassword, s.email, s.address],
      );
    }
    console.log('✓ 20 students added (password: student123)');

    // Add some completed sit-in sessions for variety
    console.log('Seeding sit-in sessions...');
    let sessionCount = 0;
    for (let i = 0; i < 15; i++) {
      const s = students[Math.floor(Math.random() * students.length)];
      const purpose = purposes[Math.floor(Math.random() * purposes.length)];
      const lab = labs[Math.floor(Math.random() * labs.length)];
      const daysAgo = Math.floor(Math.random() * 14);
      const hour = 7 + Math.floor(Math.random() * 10);

      const studentName = [s.first, s.middle, s.last].filter(Boolean).join(' ');
      await conn.query(
        `INSERT INTO sit_in_sessions (id_number, student_name, purpose, lab, status, created_at, ended_at)
         VALUES (?, ?, ?, ?, 'completed', DATE_SUB(NOW(), INTERVAL ? DAY) + INTERVAL ? HOUR, DATE_SUB(NOW(), INTERVAL ? DAY) + INTERVAL ? HOUR)`,
        [s.id, studentName, purpose, lab, daysAgo, hour, daysAgo, hour + 1 + Math.floor(Math.random() * 2)],
      );
      sessionCount++;

      // Decrease remaining sessions
      await conn.query(
        'UPDATE users SET remaining_sessions = remaining_sessions - 1 WHERE id_number = ? AND remaining_sessions > 0',
        [s.id],
      );
    }
    console.log(`✓ ${sessionCount} completed sit-in sessions added`);

    // Add 15 active sit-in sessions (currently sitting in)
    console.log('Seeding active sit-in sessions...');
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const activeStudents = shuffled.slice(0, 15);
    let activeCount = 0;
    for (const s of activeStudents) {
      const purpose = purposes[Math.floor(Math.random() * purposes.length)];
      const lab = labs[Math.floor(Math.random() * labs.length)];
      const studentName = [s.first, s.middle, s.last].filter(Boolean).join(' ');
      const minutesAgo = 10 + Math.floor(Math.random() * 120);

      await conn.query(
        `INSERT INTO sit_in_sessions (id_number, student_name, purpose, lab, status, created_at, last_heartbeat)
         VALUES (?, ?, ?, ?, 'active', DATE_SUB(NOW(), INTERVAL ? MINUTE), NOW())`,
        [s.id, studentName, purpose, lab, minutesAgo],
      );
      activeCount++;

      await conn.query(
        'UPDATE users SET remaining_sessions = remaining_sessions - 1 WHERE id_number = ? AND remaining_sessions > 0',
        [s.id],
      );
    }
    console.log(`✓ ${activeCount} active sit-in sessions added`);

    console.log('\nSeed complete!');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
    process.exit(0);
  }
}

seed();
