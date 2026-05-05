const pool = require('../config/db');

const REDEMPTION_COST = 3;

async function awardPoints(id_number, delta, reason) {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error('delta must be a non-zero integer');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      'UPDATE users SET reward_points = reward_points + ? WHERE id_number = ?',
      [delta, id_number],
    );
    await conn.query(
      'INSERT INTO point_history (id_number, delta, reason) VALUES (?, ?, ?)',
      [id_number, delta, reason],
    );

    let redemptions = 0;
    while (true) {
      const [[row]] = await conn.query(
        'SELECT reward_points FROM users WHERE id_number = ? FOR UPDATE',
        [id_number],
      );
      if (!row || row.reward_points < REDEMPTION_COST) break;

      await conn.query(
        `UPDATE users
         SET reward_points = reward_points - ?,
             remaining_sessions = remaining_sessions + 1
         WHERE id_number = ?`,
        [REDEMPTION_COST, id_number],
      );
      await conn.query(
        'INSERT INTO point_history (id_number, delta, reason) VALUES (?, ?, ?)',
        [id_number, -REDEMPTION_COST, 'redeemed: +1 sit-in session'],
      );
      redemptions += 1;
    }

    await conn.commit();
    return { redemptions };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { awardPoints, REDEMPTION_COST };
