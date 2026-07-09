import { config } from 'dotenv';
config();
import pg from 'pg';

const { Pool } = pg;
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('Altering sources table to add config column...');
    await client.query("ALTER TABLE sources ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;");
    console.log('Altered sources table');
  } catch (err) {
    console.error('Failed to alter table:', err);
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
