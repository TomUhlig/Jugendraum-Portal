// Führt db/schema.sql gegen DATABASE_URL aus.  Aufruf: npm run db:migrate
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL fehlt (siehe .env.example).'); process.exit(1); }
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  console.log('Schema ist aktuell.');
} catch (e) {
  console.error('Migration fehlgeschlagen:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
