import { currentAdmin } from '@/lib/auth';
import { bookingsForYear, getCategories, listPayments } from '@/lib/data';
import { berlinHm, berlinYmd } from '@/lib/time';

export const dynamic = 'force-dynamic';
const cell = (v: unknown) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const dec = (n: number) => n.toFixed(2).replace('.', ',');

/** Einzelposten eines Jahres für die Kasse (Excel, Semikolon, UTF-8 mit BOM). */
export async function GET(req: Request) {
  if (!(await currentAdmin())) return new Response('Nicht angemeldet', { status: 401 });
  const year = Number(new URL(req.url).searchParams.get('jahr')) || new Date().getFullYear();
  const [list, cats] = await Promise.all([bookingsForYear(year), getCategories()]);
  const cat = new Map(cats.map((c) => [c.id, c.name]));
  const head = ['Nummer', 'Datum', 'Von', 'Bis', 'Stunden', 'Art', 'Anlass', 'Bucher', 'Typ', 'Mannschaft', 'Entgelt', 'Entgelt bezahlt', 'Kaution', 'Kaution erhalten', 'Kaution zurück', 'Einbehalten', 'Online bezahlt'];
  const rows: unknown[][] = [];
  for (const b of list) {
    const online = (await listPayments(b.id)).filter((p) => p.status !== 'open' && p.status !== 'failed').reduce((s, p) => s + p.amount - p.refunded, 0);
    rows.push([b.number, berlinYmd(b.start), berlinHm(b.start), berlinHm(b.end), dec((b.end - b.start) / 3.6e6), cat.get(b.categoryId), b.title, b.name,
      b.bookerType === 'member' ? 'Mitglied' : 'Extern', b.team, dec(b.rent), b.rentPaid ? 'ja' : 'nein', dec(b.deposit), b.depositPaid ? 'ja' : 'nein',
      b.depositReturned ? dec(b.deposit - b.depositWithheld) : '', b.depositReturned ? dec(b.depositWithheld) : '', online ? dec(online) : '']);
  }
  const sum = (i: number, cond?: (r: unknown[]) => boolean) => dec(rows.filter((r) => !cond || cond(r)).reduce((s, r) => s + (Number(String(r[i]).replace(',', '.')) || 0), 0));
  rows.push([], ['Summe', '', '', '', sum(4), '', '', '', '', '', sum(10), `bezahlt: ${sum(10, (r) => r[11] === 'ja')}`, sum(12), '', sum(14), sum(15), sum(16)]);
  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="jugendraum-jahresuebersicht-${year}.csv"` } });
}
