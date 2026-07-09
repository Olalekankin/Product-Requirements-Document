import { config } from 'dotenv';
config();
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('Seeding RSS source and keyword...');
    // Insert a common RSS jobs feed
    const feedUrl = 'https://weworkremotely.com/categories/remote-programming-jobs.rss';
    const insertSrc = await client.query(
      `INSERT INTO sources (name, slug, type, url, enabled, config, jobs_found) VALUES ($1,$2,$3,$4,$5,$6,0) ON CONFLICT (slug) DO UPDATE SET url=EXCLUDED.url, enabled=EXCLUDED.enabled RETURNING id`,
      ['WeWorkRemotely - Programming', 'wwr-programming', 'rss', feedUrl, true, {}]
    );
    console.log('source id', insertSrc.rows[0].id);

    // Ensure there's at least one enabled keyword
    const kw = 'engineer';
    const res = await client.query('SELECT id FROM keywords WHERE term=$1', [kw]);
    if (res.rows.length === 0) {
      await client.query('INSERT INTO keywords (term, enabled) VALUES ($1,$2)', [kw, true]);
      console.log('inserted keyword', kw);
    } else {
      await client.query('UPDATE keywords SET enabled=true WHERE term=$1', [kw]);
      console.log('enabled existing keyword', kw);
    }

    console.log('Seed complete');
  } catch (err) {
    console.error('Seed failed', err);
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
