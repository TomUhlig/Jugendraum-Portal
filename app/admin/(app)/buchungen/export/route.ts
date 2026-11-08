import { currentAdmin } from '@/lib/auth';
import { getCategories, listBookings } from '@/lib/data';
import { parseFilter } from '@/lib/filters';
import { STATUS_LABEL } from '@/lib/labels';
import { berlinHm, berlinYmd } from '@/lib/time';

export const dynamic = 'force-dynamic';

const cell = (v: unknown) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const dec = (n: number) => n.toFixed(2).replace('.', ',');

/** CSV für Excel (Semikolon, UTF-8 mit BOM), gefiltert wie die Buchungsliste. */
export async function GET(req: Request) {
  if (!(await currentAdmin())) return new Response('Nicht angemeldet', { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const [cats, list] = await Promise.all([getCategories(), listBookings(parseFilter(sp))]);
  const cat = new Map(cats.map((c) => [c.id, c.name]));
  const head = ['Nummer', 'Datum', 'Von', 'Bis', 'Art', 'Anlass', 'Status', 'Personen', 'Bucher', 'Typ', 'Mannschaft', 'E-Mail', 'Telefon', 'Abgesprochen mit', 'Ausstattung', 'Entgelt', 'Entgelt bezahlt', 'Kaution', 'Kaution abgerechnet', 'Einbehalten', 'Schlüssel zurück', 'Zustand'];
  const rows = list.map((b) => [b.number, berlinYmd(b.start), berlinHm(b.start), berlinHm(b.end), cat.get(b.categoryId), b.title, STATUS_LABEL[b.status], b.guests, b.name,
    b.bookerType === 'member' ? 'Mitglied' : 'Extern', b.team, b.email, b.phone, b.agreedWith, b.equipment.join(', '), dec(b.rent), b.rentPaid ? 'ja' : 'nein',
    dec(b.deposit), b.depositReturned ? 'ja' : 'nein', dec(b.depositWithheld), b.returnAt ? 'ja' : 'nein', b.conditionOk === null ? '' : b.conditionOk ? 'in Ordnung' : 'Mängel']);
  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="jugendraum-buchungen-${berlinYmd(Date.now())}.csv"` } });
}
