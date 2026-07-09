import { config } from 'dotenv';
config();
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async()=>{
  const client = await pool.connect();
  try{
    const res = await client.query('SELECT id,title,company,source,url,ai_summary FROM jobs ORDER BY created_at DESC LIMIT 20');
    console.log('jobs:', JSON.stringify(res.rows, null, 2));
  }catch(e){console.error(e)}finally{client.release(); await pool.end();}
})();
