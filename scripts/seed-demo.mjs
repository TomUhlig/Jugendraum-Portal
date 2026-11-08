// Beispieldaten zum Ausprobieren (nur für Test-Datenbanken!). Aufruf: npm run db:seed
import postgres from 'postgres';
import { randomBytes } from 'node:crypto';

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL fehlt.'); process.exit(1); }
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const [{ n }] = await sql`select count(*)::int as n from bookings`;
if (n > 0 && !process.argv.includes('--force')) { console.error(`Es gibt schon ${n} Buchungen. Abbruch (mit --force trotzdem).`); process.exit(1); }

// Nächster Freitag (Berliner Datum, Uhrzeiten als Ortszeit über AT TIME ZONE)
const d = new Date(); const fri = new Date(d); fri.setDate(d.getDate() + (((5 - d.getDay() + 7) % 7) || 7));
const day = (offset) => { const x = new Date(fri); x.setDate(fri.getDate() + offset); return x.toISOString().slice(0, 10); };
const tok = () => randomBytes(18).toString('base64url');
const rows = [
  ['meet', 'Trainerbesprechung Jugend', -3, '19:00', -3, '20:30', 'confirmed', 'Jens Petersen', 'Jugendleitung', 'member', 10, null],
  ['meet', 'Vorstandssitzung', -1, '19:00', -1, '22:00', 'confirmed', 'Vorstand', 'Vorstand', 'member', 9, null],
  ['party', '40. Geburtstag', 1, '18:00', 2, '01:00', 'confirmed', 'Sandra Köhler', '', 'external', 38, 0],
  ['team', 'Saisonabschluss C1', 2, '11:00', 2, '14:00', 'confirmed', 'Marco Ludwig', 'C1-Jugend', 'member', 22, null],
  ['event', 'Elternabend E-Jugend', 4, '19:00', 4, '21:00', 'confirmed', 'Anke Wiese', 'E-Jugend', 'member', 30, null],
  ['party', 'Abschlussfeier A-Jugend', 7, '19:00', 7, '23:30', 'requested', 'Lukas Hoffmann', 'A-Jugend', 'member', 35, 7],
  ['work', 'Erste-Hilfe-Kurs Trainer', 8, '10:00', 8, '15:00', 'requested', 'DRK Kursteam', '', 'external', 18, null],
  ['party', 'Polterabend', 15, '17:00', 16, '01:00', 'confirmed', 'Familie Brandt', '', 'external', 40, 14],
];
for (const [cat, title, ds, ts, de, te, status, name, team, type, guests, pw] of rows) {
  await sql`insert into bookings (category_id, title, starts_at, ends_at, status, name, team, booker_type, guests, email, phone, agreed_with, party_weekend, manage_token, verified_at)
    values (${cat}, ${title}, (${day(ds) + ' ' + ts}::timestamp at time zone 'Europe/Berlin'), (${day(de) + ' ' + te}::timestamp at time zone 'Europe/Berlin'),
      ${status}, ${name}, ${team}, ${type}, ${guests}, ${'demo+' + tok().slice(0, 6) + '@example.org'}, '0521 000000', 'Michael Grieswelle', ${pw === null ? null : day(pw)}, ${tok()}, now())`;
}
console.log(`${rows.length} Beispielbuchungen angelegt.`);
await sql.end();
