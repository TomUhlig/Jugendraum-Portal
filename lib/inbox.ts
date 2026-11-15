import 'server-only';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { db } from './db';
import { addMessage, getBooking, listAdmins, notifyRecipients, type Booking } from './data';
import { findBookingNumber, imapConfig, inboxEnabled, stripReply } from './inbox-parse';
export { imapConfig, inboxEnabled };
import { mails, teamMails } from './mail';
import { pushTeam } from './push';

/**
 * Antworten auf Mails des Portals landen im Nachrichtenverlauf der Buchung.
 * Abruf per IMAP aus demselben Postfach, über das verschickt wird.
 * IMAP_HOST (optional; bei Gmail, GMX, WEB.DE, Outlook automatisch), IMAP_USER/IMAP_PASS (Standard: SMTP_USER/SMTP_PASS).
 */


export type InboxResult = { checked: number; added: number; skipped: number; error?: string };

/** Ungelesene Antworten der letzten 14 Tage abholen. Fremde Mails bleiben unberührt (ungelesen). */
export async function pollInbox(): Promise<InboxResult> {
  const cfg = imapConfig();
  if (!cfg) return { checked: 0, added: 0, skipped: 0, error: 'nicht eingerichtet' };
  const res: InboxResult = { checked: 0, added: 0, skipped: 0 };
  const client = new ImapFlow({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass }, logger: false, socketTimeout: 20_000,
    ...(process.env.IMAP_INSECURE_TLS === '1' ? { tls: { rejectUnauthorized: false } } : {}) });
  client.on('error', (e: unknown) => { res.error = String((e as Error)?.message ?? e).slice(0, 200); }); // sonst stürzt der Prozess ab
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = (await client.search({ seen: false, since: new Date(Date.now() - 14 * 864e5) }, { uid: true })) || [];
      const candidates: { uid: number; number: string }[] = [];
      for await (const m of client.fetch(uids.slice(-200), { envelope: true, uid: true }, { uid: true })) {
        const e = m.envelope;
        const rcpt = [...(e?.to ?? []), ...(e?.cc ?? [])].map((a) => a.address ?? '');
        const num = findBookingNumber(rcpt, e?.subject ?? '');
        if (num) candidates.push({ uid: m.uid, number: num });
      }
      res.checked = candidates.length;
      const admins = await listAdmins();
      for (const c of candidates) {
        const msg = await client.fetchOne(String(c.uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const mail = await simpleParser(msg.source);
        const messageId = mail.messageId || `uid-${c.uid}`;
        const [seen] = await db()`select accepted from inbound_mail where message_id = ${messageId}`;
        if (seen) { if (seen.accepted) await client.messageFlagsAdd(String(c.uid), ['\\Seen'], { uid: true }); res.skipped++; continue; }
        const [row] = await db()`select id from bookings where number = ${c.number}`;
        const b = row ? await getBooking(row.id) : null;
        const from = (mail.from?.value?.[0]?.address ?? '').toLowerCase();
        const admin = admins.find((a) => a.email.toLowerCase() === from && a.role !== 'viewer');
        const body = stripReply(mail.text ?? '').slice(0, 2000);
        let ok = false;
        if (b && body.length >= 1) {
          if (from === b.email.toLowerCase()) { await bookerReply(b, body); ok = true; }
          else if (admin) { await teamReply(b, admin.name, body); ok = true; }
        }
        await db()`insert into inbound_mail (message_id, booking_id, sender, accepted) values (${messageId}, ${b?.id ?? null}, ${from}, ${ok}) on conflict do nothing`;
        // Nur zugeordnete Antworten als gelesen markieren; alles andere bleibt für Menschen sichtbar
        if (ok) { await client.messageFlagsAdd(String(c.uid), ['\\Seen'], { uid: true }); res.added++; } else res.skipped++;
      }
    } finally { lock.release(); }
    await client.logout();
  } catch (e) {
    res.error = String((e as Error)?.message ?? e).slice(0, 200);
    console.error('Postfach-Abruf:', e);
    try { client.close(); } catch {}
  }
  await db()`insert into settings (key, value) values ('inbox', ${db().json({ at: Date.now(), ...res })}) on conflict (key) do update set value = excluded.value`.catch(() => {});
  return res;
}

async function bookerReply(b: Booking, body: string) {
  await addMessage(b.id, 'booker', b.name, body);
  try { await teamMails.message(await notifyRecipients(), b, body); } catch (e) { console.error(e); }
  await pushTeam({ title: `Nachricht von ${b.name}`, body: body.slice(0, 140), url: `/admin/buchung/${b.id}#nachrichten`, tag: 'msg-' + b.id });
}
async function teamReply(b: Booking, name: string, body: string) {
  await addMessage(b.id, 'team', name, body);
  if (!b.silent) await mails.message(b, name, body).catch(() => {});
}

const g = globalThis as unknown as { __inboxAt?: number; __inboxRun?: Promise<unknown> };
/** Höchstens alle 2 Minuten abrufen (z. B. beim Öffnen der Verwaltung). */
export async function pollInboxThrottled(minMs = 120_000) {
  if (!inboxEnabled()) return;
  if (g.__inboxRun || (g.__inboxAt && Date.now() - g.__inboxAt < minMs)) return;
  g.__inboxAt = Date.now();
  g.__inboxRun = pollInbox().finally(() => { g.__inboxRun = undefined; });
  await g.__inboxRun;
}
