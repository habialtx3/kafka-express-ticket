const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

async function initDB() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
  await connection.end();

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  const queries = [
    `CREATE TABLE IF NOT EXISTS stocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eventId INT NOT NULL UNIQUE,
      totalSeats INT NOT NULL,
      reservedSeats INT DEFAULT 0,
      availableSeats INT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  ];

  for (const query of queries) {
    await pool.query(query);
  }

  console.log(`Database ${process.env.DB_NAME} initialized successfully.`);
}

const getPool = () => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDB() first.');
  }
  return pool;
};

module.exports = {
  initDB,
  getPool,
};
