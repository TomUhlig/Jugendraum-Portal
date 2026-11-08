// Legt eine Person für die Verwaltung an oder aktualisiert sie.
// Aufruf: npm run admin:add -- tom@example.de "Tom" admin
// Rollen: admin (alles), manager (Anfragen + Kalender), viewer (nur ansehen)
import postgres from 'postgres';

const [email, name, role = 'manager'] = process.argv.slice(2);
if (!process.env.DATABASE_URL || !email || !name) {
  console.error('Aufruf: DATABASE_URL=… npm run admin:add -- <email> "<Name>" [admin|manager|viewer]');
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
await sql`insert into admins (email, name, role) values (${email.toLowerCase()}, ${name}, ${role})
  on conflict (email) do update set name = excluded.name, role = excluded.role`;
console.log(`${name} <${email}> ist jetzt ${role}.`);
await sql.end();
