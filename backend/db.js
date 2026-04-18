const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.PG_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

let logged = false;
pool.on('connect', () => {
  if (!logged) {
    console.log('Connected to PostgreSQL database');
    logged = true;
  }
});

// Render's managed Postgres drops idle connections; pg emits 'error' on the
// affected client. Don't crash the process — the pool creates a replacement
// on the next query.
pool.on('error', (err) => {
  console.error('Idle pg client error (non-fatal):', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};
