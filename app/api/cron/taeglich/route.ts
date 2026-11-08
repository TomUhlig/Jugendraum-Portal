import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Booking, getBooking, getCategories, listBookings, notifyRecipients } from '@/lib/data';
import { mails, teamMails } from '@/lib/mail';
import { DAY, addDays, berlinParts, berlinToUtc, berlinYmd } from '@/lib/time';

export const dynamic = 'force-dynamic';

/**
 * Täglicher Lauf (Vercel Cron, siehe vercel.json). Kann auch öfter laufen, alles ist idempotent.
 * Verfallene Anfragen, Erinnerungen, Nachfrage, Wochenübersicht (montags), Löschung alter Daten.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Nicht erlaubt', { status: 401 });
  const q = db();
  const now = Date.now();
  const today = berlinYmd(now);
  const cats = new Map((await getCategories()).map((c) => [c.id, c]));
  const report: Record<string, number> = {};
  const load = async (rows: { id: string }[]) => (await Promise.all(rows.map((r) => getBooking(r.id)))).filter(Boolean) as Booking[];

  // 1. Unbestätigte Anfragen nach 24 h freigeben
  const expired = await q`update bookings set status = 'expired' where status = 'pending_email' and created_at < now() - interval '24 hours' returning id`;
  for (const r of expired) await q`insert into audit_log (actor, booking_id, action) values ('system', ${r.id}, 'expired')`;
  report.expired = expired.length;

  // 2. Erinnerung 3 Tage vorher
  const r3 = await load(await q`select id from bookings where status = 'confirmed' and not silent and reminded_3d_at is null
    and starts_at >= ${new Date(berlinToUtc(addDays(today, 2), '00:00'))} and starts_at < ${new Date(berlinToUtc(addDays(today, 4), '00:00'))}`);
  for (const b of r3) if (await mails.reminder(b, cats.get(b.categoryId), '3d')) await q`update bookings set reminded_3d_at = now() where id = ${b.id}`;
  report.reminder3d = r3.length;

  // 3. Erinnerung am Vortag (bzw. am selben Tag, wenn kurzfristig gebucht)
  const r1 = await load(await q`select id from bookings where status = 'confirmed' and not silent and reminded_1d_at is null
    and starts_at > now() and starts_at < ${new Date(berlinToUtc(addDays(today, 2), '00:00'))}`);
  for (const b of r1) if (await mails.reminder(b, cats.get(b.categoryId), '1d')) await q`update bookings set reminded_1d_at = now(), reminded_3d_at = coalesce(reminded_3d_at, now()) where id = ${b.id}`;
  report.reminder1d = r1.length;

  // 4. Nachfrage nach dem Termin
  const fu = await load(await q`select id from bookings where status = 'confirmed' and not silent and followup_at is null
    and ends_at < now() - interval '2 hours' and ends_at > now() - interval '4 days'`);
  for (const b of fu) if (await mails.followup(b)) await q`update bookings set followup_at = now() where id = ${b.id}`;
  report.followup = fu.length;

  // 5. Montags: Wochenübersicht ans Team (einmal pro Tag)
  if (berlinParts(now).weekday === 1) {
    const [sent] = await q`select 1 from mail_log where kind = 'digest' and created_at > ${new Date(berlinToUtc(today, '00:00'))} limit 1`;
    if (!sent) {
      const week = await listBookings({ status: ['confirmed'], from: now, to: now + 7 * DAY });
      const open = (await listBookings({ status: ['requested'] })).length;
      await teamMails.digest(await notifyRecipients(), week.map((b) => ({ b, c: cats.get(b.categoryId) })), open);
      report.digest = 1;
    }
  }

  // 6. Datenschutz: personenbezogene Daten 12 Monate nach dem Termin entfernen
  const anon = await q`update bookings set name = 'gelöscht', email = 'geloescht@invalid', phone = '', note = '', team = '', internal_note = ''
    where ends_at < now() - interval '12 months' and email <> 'geloescht@invalid' returning id`;
  report.anonymized = anon.length;

  return NextResponse.json({ ok: true, ...report });
}
