const mysql = require('mysql2/promise');

let pool;

/**
 * Retorna um pool compartilhado de conexões MySQL/MariaDB.
 * Reutiliza a mesma instância entre chamadas na Vercel (serverless) e no servidor local.
 */
function getPool() {
  if (pool) return pool;

  const databaseUrl = process.env.DATABASE_URL;
  const useSsl = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
  const sslConfig = useSsl ? { rejectUnauthorized: false } : undefined;

  if (databaseUrl) {
    pool = mysql.createPool({
      uri: databaseUrl,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      ssl: sslConfig,
      decimalNumbers: true,
    });
  } else {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || process.env.DB_DATABASE || 'mercearia_costa',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      ssl: sslConfig,
      decimalNumbers: true,
    });
  }

  return pool;
}

module.exports = { getPool };
