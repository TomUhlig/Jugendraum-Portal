import 'server-only';
import { Booking, checkExisting, freeWaitlistFor, getCategories, markStripePaid, notifyRecipients } from './data';
import { getCheckout } from './stripe';
import { pushTeam } from './push';
import { fmtDay } from './time';
import { bookerMails, mails, teamMails } from './mail';

/** Mails dürfen eine bereits gespeicherte Aktion nie abbrechen: Fehler werden nur protokolliert. */
async function safe(label: string, fn: () => Promise<unknown>) {
  try { await fn(); } catch (e) { console.error(`Benachrichtigung „${label}“ fehlgeschlagen:`, e); }
}
const categoryOf = async (b: Booking) => (await getCategories()).find((c) => c.id === b.categoryId);

/** Nach der E-Mail-Bestätigung: Bucher und Orga-Team informieren. */
export async function afterVerified(b: Booking) {
  await safe('verified', async () => {
    const cat = await categoryOf(b);
    const team = await notifyRecipients();
    if (b.status === 'confirmed') {
      await mails.confirmed(b, cat);
      await teamMails.autoConfirmed(team, b, cat);
      await pushTeam({ title: `Neuer Termin: ${b.title}`, body: `${fmtDay(b.start)} · ${b.name} (automatisch eingetragen)`, url: `/admin/buchung/${b.id}` });
    } else {
      await pushTeam({ title: `Neue Anfrage: ${b.title}`, body: `${fmtDay(b.start)} · ${b.name}${b.bookerType === 'external' ? ' (nicht im Verein)' : ''}`, url: `/admin/buchung/${b.id}`, tag: 'anfrage-' + b.id });
      await mails.received(b, cat);
      const conflicts = (await checkExisting(b)).messages.map((m) => m.text).join(' ');
      await teamMails.newRequest(team, b, cat, conflicts || undefined);
    }
  });
}

export async function afterDecision(b: Booking) {
  await safe('decision', async () => {
    const cat = await categoryOf(b);
    if (b.status === 'confirmed') await mails.confirmed(b, cat);
    if (b.status === 'rejected') await mails.rejected(b, cat);
    if (b.status === 'cancelled') await mails.cancelled(b, cat);
  });
  if (b.status === 'rejected' || b.status === 'cancelled') await notifyWaitlist([b]);
}

export async function afterBookerCancel(b: Booking) {
  await safe('booker-cancel', async () => {
    const cat = await categoryOf(b);
    await mails.cancelled(b, cat);
    await teamMails.cancelled(await notifyRecipients(), b, cat);
    await pushTeam({ title: `Abgesagt: ${b.title}`, body: `${fmtDay(b.start)} · ${b.name} hat abgesagt. Der Termin ist wieder frei.`, url: `/admin/buchung/${b.id}` });
  });
  await notifyWaitlist([b]);
}

/** Ein Termin ist frei geworden: Wartende benachrichtigen, deren Wunschzeit jetzt wieder anfragbar ist. */
export async function notifyWaitlist(freed: { start: number; end: number }[]) {
  await safe('waitlist', async () => {
    if (!freed.length) return;
    const start = Math.min(...freed.map((f) => f.start)), end = Math.max(...freed.map((f) => f.end));
    for (const w of await freeWaitlistFor(start, end)) await bookerMails.waitlistFree(w);
  });
}

/** Stripe-Zahlung prüfen und verbuchen (Rückkehrseite und Webhook). true, wenn bezahlt. */
export async function confirmStripeSession(sessionId: string, bookingId: string | null): Promise<boolean> {
  const session = await getCheckout(sessionId);
  if (bookingId && session.metadata?.booking_id && session.metadata.booking_id !== bookingId) return false;
  if (session.payment_status !== 'paid') return false;
  const res = await markStripePaid(session.id, typeof session.payment_intent === 'string' ? session.payment_intent : null);
  if (res) await safe('paid-mail', () => mails.paid(res.booking, res.payment.amount));
  return true;
}
