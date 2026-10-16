// Postgres (Supabase) access. Reads the connection string from DATABASE_URL,
// or POSTGRES_URL as set by Vercel's Supabase integration.
const { Pool, types } = require('pg');

const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!raw) {
  throw new Error('DATABASE_URL is not set. Add your Supabase connection string to .env (locally) or the Vercel project settings.');
}

// Supabase's pooler uses a certificate pg can't verify from an sslmode in the
// URL, so drop that and turn on SSL below instead.
const url = new URL(raw);
url.searchParams.delete('sslmode');

// BIGINT columns (timestamps in ms) come back as strings by default.
types.setTypeParser(types.builtins.INT8, (value) => Number(value));

// A small pool: on Vercel each function instance holds its own connections.
const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false }, max: 3 });

// Queries are written with `?` placeholders; Postgres wants $1, $2, ...
function toPg(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

async function all(sql, ...params) {
  return (await pool.query(toPg(sql), params)).rows;
}

async function get(sql, ...params) {
  return (await all(sql, ...params))[0];
}

// Returns the pg result, for rowCount or RETURNING rows.
function run(sql, ...params) {
  return pool.query(toPg(sql), params);
}

module.exports = { all, get, run, pool };
