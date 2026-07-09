import { config } from 'dotenv';
config();
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async()=>{
  const client = await pool.connect();
  try{
    const res = await client.query('SELECT id,url,title,status,processed_at FROM job_candidates ORDER BY discovered_at DESC LIMIT 50');
    console.log('candidates:', JSON.stringify(res.rows, null, 2));
  }catch(e){console.error(e)}finally{client.release(); await pool.end();}
})();
