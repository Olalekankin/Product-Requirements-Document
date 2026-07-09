import { config } from 'dotenv';
config();
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async()=>{
  const client = await pool.connect();
  try{
    const res = await client.query('SELECT id, name, slug, type, url, enabled, config FROM sources ORDER BY id DESC LIMIT 20');
    console.log('sources:', JSON.stringify(res.rows, null, 2));
  }catch(e){console.error(e)}finally{client.release(); await pool.end();}
})();
