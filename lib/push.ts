import 'server-only';
import webpush from 'web-push';
import { db } from './db';
import { appUrl } from './url';

type Keys = { publicKey: string; privateKey: string };
const g = globalThis as unknown as { __vapid?: Keys };

/** VAPID-Schlüssel: aus Umgebungsvariablen oder beim ersten Mal erzeugt und in der Datenbank gespeichert. */
export async function vapidKeys(): Promise<Keys> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  if (g.__vapid) return g.__vapid;
  const [row] = await db()`select value from settings where key = 'vapid'`;
  if (row?.value?.publicKey) return (g.__vapid = row.value as Keys);
  const k = webpush.generateVAPIDKeys();
  await db()`insert into settings (key, value) values ('vapid', ${db().json({ publicKey: k.publicKey, privateKey: k.privateKey })}) on conflict (key) do nothing`;
  const [again] = await db()`select value from settings where key = 'vapid'`; // falls parallel erzeugt
  return (g.__vapid = again.value as Keys);
}

export async function saveSubscription(adminId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, device: string) {
  await db()`insert into push_subscriptions (admin_id, endpoint, p256dh, auth, device) values (${adminId}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${device.slice(0, 120)})
    on conflict (endpoint) do update set admin_id = excluded.admin_id, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device`;
}
export async function removeSubscription(endpoint: string) { await db()`delete from push_subscriptions where endpoint = ${endpoint}`; }
export async function countSubscriptions(adminId: string): Promise<number> {
  const [r] = await db()`select count(*)::int as n from push_subscriptions where admin_id = ${adminId}`; return r.n;
}

type Push = { title: string; body: string; url: string; tag?: string };

async function send(rows: Record<string, unknown>[], p: Push): Promise<number> {
  if (!rows.length) return 0;
  const keys = await vapidKeys();
  const contact = process.env.SMTP_USER || process.env.INITIAL_ADMIN_EMAIL || 'admin@example.org';
  webpush.setVapidDetails(`mailto:${contact}`, keys.publicKey, keys.privateKey);
  const payload = JSON.stringify({ ...p, url: p.url.startsWith('http') ? p.url : appUrl() + p.url });
  let ok = 0;
  await Promise.all(rows.map(async (r) => {
    try {
      await webpush.sendNotification({ endpoint: r.endpoint as string, keys: { p256dh: r.p256dh as string, auth: r.auth as string } }, payload, { TTL: 86400, urgency: 'normal' });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await removeSubscription(r.endpoint as string); // Gerät abgemeldet
      else console.error('Push fehlgeschlagen:', code ?? e);
    }
  }));
  return ok;
}

/** An alle Team-Mitglieder mit aktivierter Benachrichtigung (gleiche Regel wie bei Mails). */
export async function pushTeam(p: Push): Promise<number> {
  try {
    const rows = await db()`select s.* from push_subscriptions s join admins a on a.id = s.admin_id where a.notify and a.role <> 'viewer'`;
    return await send(rows, p);
  } catch (e) { console.error('Push an das Team fehlgeschlagen:', e); return 0; }
}
export async function pushAdmin(adminId: string, p: Push): Promise<number> {
  return send(await db()`select * from push_subscriptions where admin_id = ${adminId}`, p);
}
