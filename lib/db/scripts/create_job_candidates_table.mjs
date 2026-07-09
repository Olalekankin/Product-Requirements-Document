import { config } from 'dotenv';
config();
import pg from 'pg';

const { Pool } = pg;
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
CREATE TABLE IF NOT EXISTS job_candidates (
  id SERIAL PRIMARY KEY,
  source_id integer NOT NULL,
  source text NOT NULL,
  source_type text NOT NULL DEFAULT 'rss',
  url text NOT NULL,
  title text NOT NULL,
  company text NOT NULL,
  description text,
  salary text,
  location text,
  employment_type text,
  remote boolean,
  posted_at text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  raw_data jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('Applying DDL for job_candidates...');
    await client.query(sql);
    console.log('job_candidates table created or already exists');
  } catch (err) {
    console.error('Failed to create table:', err);
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
