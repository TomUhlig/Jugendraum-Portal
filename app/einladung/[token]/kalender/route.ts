import { bookingIdFromGuestToken } from '@/lib/auth';
import { getBooking, getExtras } from '@/lib/data';
import { icsJoin, icsStamp, icsText } from '@/lib/ics';
import { appUrl } from '@/lib/url';

/** Kalenderdatei für Gäste: ohne Verwaltungslink und ohne Daten des Buchers. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = bookingIdFromGuestToken(token);
  const b = id ? await getBooking(id) : null;
  if (!b || b.status !== 'confirmed') return new Response('Nicht gefunden', { status: 404 });
  const addr = ((await getExtras()).operator.roomAddress || 'Jugendraum SV Heepen').replace(/\n/g, ', ');
  const ics = icsJoin(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SV Heepen//Jugendraum//DE', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${b.id}-gast@${new URL(appUrl()).hostname}`, `DTSTAMP:${icsStamp(Date.now())}`, `DTSTART:${icsStamp(b.start)}`, `DTEND:${icsStamp(b.end)}`,
    `SUMMARY:${icsText(b.title)}`, `LOCATION:${icsText(addr)}`, `DESCRIPTION:${icsText(`${appUrl()}/einladung/${token}`)}`, 'END:VEVENT', 'END:VCALENDAR']);
  return new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="einladung.ics"' } });
}
