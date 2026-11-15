import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Schnellsuche der Verwaltung: Buchungen nach Titel, Name, Team, Nummer, E-Mail; nächstgelegene Termine zuerst. */
export async function GET(req: Request) {
  if (!(await currentAdmin())) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  const term = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 60);
  if (term.length < 2) return NextResponse.json({ items: [] });
  const like = `%${term.replace(/[%_\\]/g, '')}%`;
  const rows = await db()`select id, number, title, name, team, status, starts_at, ends_at, category_id from bookings
    where title ilike ${like} or name ilike ${like} or team ilike ${like} or number ilike ${like} or email ilike ${like} or phone ilike ${like}
    order by (starts_at < now()), abs(extract(epoch from starts_at - now())) limit 8`;
  return NextResponse.json({ items: rows.map((r) => ({ id: r.id, number: r.number, title: r.title, name: r.name, team: r.team, status: r.status, start: +r.starts_at, end: +r.ends_at, categoryId: r.category_id })) });
}
