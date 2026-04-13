/**
 * Reset database to fresh state.
 * Drops all tables, recreates schema, and seeds default data.
 *
 * Usage: npm run db:reset
 *
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_NAME = process.env.DB_NAME || 'sit_monitoring';

async function resetDatabase() {
  let conn;

  try {
    // Connect without specifying database (it may not exist yet)
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });

    console.log('Connected to MySQL.');

    // Drop and recreate database
    console.log(`Dropping database "${DB_NAME}"...`);
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);

    console.log(`Creating database "${DB_NAME}"...`);
    await conn.query(`CREATE DATABASE \`${DB_NAME}\``);
    await conn.query(`USE \`${DB_NAME}\``);

    // Read and execute setup.sql
    const sqlPath = path.join(__dirname, 'setup.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');

    // Remove the CREATE DATABASE / USE lines (we already handled that)
    sql = sql
      .replace(/CREATE DATABASE IF NOT EXISTS .+;/gi, '')
      .replace(/USE .+;/gi, '');

    console.log('Running setup.sql...');
    await conn.query(sql);

    console.log('\n✓ Database reset complete!');
    console.log(`  Database: ${DB_NAME}`);
    console.log('  Admin: 00000000 / admin123');
    console.log('  Tables: users, sit_in_sessions, announcements, feedback, reservations, notifications');

    // Clean up uploaded avatars
    const uploadsDir = path.join(__dirname, '../uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      let cleaned = 0;
      for (const file of files) {
        if (file.startsWith('avatar-')) {
          fs.unlinkSync(path.join(uploadsDir, file));
          cleaned++;
        }
      }
      if (cleaned > 0) console.log(`  Cleaned ${cleaned} avatar file(s)`);
    }
  } catch (err) {
    console.error('\n✗ Database reset failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
    process.exit(0);
  }
}

resetDatabase();
