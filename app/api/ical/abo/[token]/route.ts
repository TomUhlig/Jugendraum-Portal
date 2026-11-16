import { parseShareFeed } from '@/lib/auth';
import { getCategories, listBookings } from '@/lib/data';
import { appUrl } from '@/lib/url';
import { DAY } from '@/lib/time';
import { icsJoin, icsStamp as stamp, icsText as text } from '@/lib/ics';

export const dynamic = 'force-dynamic';

/** Kalender-Abo zum Weitergeben (Mannschaft, nur Feiern, Belegung allgemein): ohne Namen, Telefonnummern und Notizen. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const f = parseShareFeed((await params).token.replace(/\.ics$/, ''));
  if (!f) return new Response('Unbekannter Link', { status: 404 });
  const now = Date.now();
  const [cats, all] = await Promise.all([getCategories(), listBookings({ status: ['confirmed'], from: now - 31 * DAY, to: now + 366 * DAY, limit: 3000 })]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const list = all.filter((b) => f.k === 'all' || (f.k === 'parties' && cat.get(b.categoryId)?.isParty) || (f.k === 'cat' && b.categoryId === f.v)
    || (f.k === 'team' && !!f.v && b.team.trim().toLowerCase() === f.v.trim().toLowerCase()));
  const name = f.k === 'all' ? 'Jugendraum belegt' : f.k === 'parties' ? 'Jugendraum Feiern' : f.k === 'cat' ? `Jugendraum ${cat.get(f.v ?? '')?.name ?? ''}` : `Jugendraum ${f.v}`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SV Heepen//Jugendraum//DE', `X-WR-CALNAME:${text(name)}`, 'X-PUBLISHED-TTL:PT1H', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H'];
  for (const b of list) {
    const c = cat.get(b.categoryId);
    // Allgemeine Belegung: nur „belegt“; sonst Anlass und Mannschaft, nie Namen oder Kontaktdaten
    const summary = f.k === 'all' ? `Jugendraum belegt${c ? ` (${c.name})` : ''}` : `${b.title}${b.team && f.k !== 'team' ? ` · ${b.team}` : ''}`;
    lines.push('BEGIN:VEVENT', `UID:${b.id}-abo@${new URL(appUrl()).hostname}`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(b.start)}`, `DTEND:${stamp(b.end)}`,
      `SUMMARY:${text(summary)}`, `LOCATION:${text('Jugendraum SV Heepen')}`, `DESCRIPTION:${text(`${c?.name ?? ''} · ${appUrl()}`)}`, 'STATUS:CONFIRMED', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return new Response(icsJoin(lines), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=900' } });
}
