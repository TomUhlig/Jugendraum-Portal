import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import type { Admin } from './data';

const COOKIE = 'jr_session';
const SESSION_DAYS = 30;
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET fehlt oder ist zu kurz (mind. 16 Zeichen).');
  return s;
};
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('base64url');

/** Legt einen einmaligen Login-Link an. Gibt null zurück, wenn die Adresse nicht im Team ist. */
export async function createLoginLink(email: string, baseUrl: string): Promise<{ to: string; link: string } | null> {
  const [admin] = await db()`select id, email from admins where email = ${email.trim().toLowerCase()}`;
  if (!admin) return null;
  const token = randomBytes(32).toString('base64url');
  await db()`insert into login_tokens (token_hash, admin_id, expires_at) values (${sha(token)}, ${admin.id}, now() + interval '15 minutes')`;
  return { to: admin.email, link: `${baseUrl}/admin/anmelden/${token}` };
}

/** Löst einen Login-Link ein und gibt den Cookie-Wert zurück. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const [row] = await db()`update login_tokens set used_at = now()
    where token_hash = ${sha(token)} and used_at is null and expires_at > now() returning admin_id`;
  if (!row) return null;
  const payload = `${row.admin_id}.${Date.now() + SESSION_DAYS * 864e5}`;
  return `${payload}.${sign(payload)}`;
}
export const sessionCookie = { name: COOKIE, maxAge: SESSION_DAYS * 86400 };

export async function currentAdmin(): Promise<Admin | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const i = raw.lastIndexOf('.');
  const payload = raw.slice(0, i), sig = raw.slice(i + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const [id, exp] = payload.split('.');
  if (+exp < Date.now()) return null;
  const [admin] = await db()`select id, email, name, role, notify from admins where id = ${id}`;
  return (admin as unknown as Admin) ?? null;
}

const RANK = { viewer: 0, manager: 1, admin: 2 } as const;
/** Für Seiten und Server Actions: leitet ohne Anmeldung zum Login um, prüft die Rolle. */
export async function requireAdmin(min: Admin['role'] = 'viewer'): Promise<Admin> {
  const a = await currentAdmin();
  if (!a) redirect('/admin/anmelden');
  if (RANK[a.role] < RANK[min]) throw new Error('Dafür fehlt dir die Berechtigung.');
  return a;
}

/** Persönlicher, geheimer Link für das Kalender-Abo (iCal) eines Team-Mitglieds. */
export const feedToken = (adminId: string) => `${adminId}.${sign('feed:' + adminId).slice(0, 24)}`;
export async function adminFromFeedToken(token: string): Promise<Admin | null> {
  const [id, sig] = token.split('.');
  if (!id || !sig || sig !== sign('feed:' + id).slice(0, 24)) return null;
  const [admin] = await db()`select id, email, name, role, notify from admins where id = ${id}`;
  return (admin as unknown as Admin) ?? null;
}
