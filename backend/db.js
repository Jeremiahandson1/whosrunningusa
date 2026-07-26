const { Pool } = require('pg');

// Per-query timeout (ms) enforced by Postgres itself. Any query that runs
// longer than this gets cancelled, which prevents a single bad query (locks,
// runaway plan, blocked on a missing index) from hanging Express requests
// indefinitely while the pool fills up. Override with PG_STATEMENT_TIMEOUT_MS.
const STATEMENT_TIMEOUT_MS = parseInt(process.env.PG_STATEMENT_TIMEOUT_MS || '15000', 10);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.PG_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

let logged = false;
pool.on('connect', (client) => {
  if (!logged) {
    console.log('Connected to PostgreSQL database');
    logged = true;
  }
  // Apply the statement timeout to every fresh connection. Errors here are
  // logged but non-fatal — if the SET fails, queries just run without the cap.
  client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`).catch((err) => {
    console.error('Failed to set statement_timeout:', err.message);
  });
});

// Render's managed Postgres drops idle connections; pg emits 'error' on the
// affected client. Don't crash the process — the pool creates a replacement
// on the next query.
pool.on('error', (err) => {
  console.error('Idle pg client error (non-fatal):', err.message);
});

// Classify a thrown error as "the database itself is unreachable" — a
// connection / DNS / shutdown / pool-exhaustion failure rather than a normal
// query error (bad SQL, missing table, constraint). Lets routes and the
// health check return a clear 503 ("temporarily unavailable") instead of a
// generic 500 when Postgres is down. Example: a suspended or expired Render
// database surfaces as `getaddrinfo ENOTFOUND dpg-…`.
function isDbUnavailable(err) {
  if (!err) return false;
  // Node socket/DNS level
  const NET = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNRESET', 'EPIPE'];
  // Postgres connection-class SQLSTATEs: admin shutdown, cannot-connect-now,
  // connection failure/exception, too-many-connections.
  const PG = ['57P01', '57P03', '08006', '08001', '08004', '08003', '53300', '53400'];
  if (NET.includes(err.code) || PG.includes(err.code)) return true;
  return /getaddrinfo|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|Connection terminated|server closed the connection|terminating connection/i.test(err.message || '');
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  isDbUnavailable,
  pool
};
