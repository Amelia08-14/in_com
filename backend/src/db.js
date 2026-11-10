const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'incom',
  password: process.env.DB_PASSWORD || 'incom_local',
  database: process.env.DB_NAME || 'incom_crm',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  timezone: '+01:00',
});

async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

module.exports = { pool, q, one };
