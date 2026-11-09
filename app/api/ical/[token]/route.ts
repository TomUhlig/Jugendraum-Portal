import { adminFromFeedToken } from '@/lib/auth';
import { getCategories, listBookings } from '@/lib/data';
import { appUrl } from '@/lib/url';
import { DAY } from '@/lib/time';
import { icsJoin, icsStamp as stamp, icsText as text } from '@/lib/ics';

export const dynamic = 'force-dynamic';


/** Kalender-Abo für das Orga-Team: alle aktiven Buchungen (−1 bis +12 Monate). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const admin = await adminFromFeedToken((await params).token.replace(/\.ics$/, ''));
  if (!admin) return new Response('Unbekannter Link', { status: 404 });
  const now = Date.now();
  const [cats, bookings] = await Promise.all([getCategories(), listBookings({ status: ['requested', 'confirmed'], from: now - 31 * DAY, to: now + 366 * DAY, limit: 2000 })]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SV Heepen//Jugendraum//DE', 'X-WR-CALNAME:Jugendraum SV Heepen', 'X-PUBLISHED-TTL:PT1H', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H'];
  for (const b of bookings) {
    lines.push('BEGIN:VEVENT', `UID:${b.id}@${new URL(appUrl()).hostname}`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(b.start)}`, `DTEND:${stamp(b.end)}`,
      `SUMMARY:${text(`${b.status === 'requested' ? '[Anfrage] ' : ''}${b.title}`)}`,
      `DESCRIPTION:${text(`${cat.get(b.categoryId)?.name ?? ''} · ${b.guests} Pers.\n${b.name}${b.team ? ' (' + b.team + ')' : ''} · ${b.phone}\nAbsprache: ${b.agreedWith}\n${appUrl()}/admin/buchung/${b.id}`)}`,
      `STATUS:${b.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return new Response(icsJoin(lines), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300' } });
}
