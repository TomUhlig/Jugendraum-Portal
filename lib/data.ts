import 'server-only';
import { randomBytes } from 'node:crypto';
import type postgres from 'postgres';
import { db } from './db';
import {
  ACTIVE_STATUSES, Blackout, Category, CheckResult, DEFAULT_SETTINGS, Settings, Slot, checkBooking, partyWeekendOf,
} from './rules';
import { DAY } from './time';

export type Status = 'pending_email' | 'requested' | 'confirmed' | 'rejected' | 'cancelled' | 'expired';
export type Booking = {
  id: string; number: string; status: Status; categoryId: string; title: string; note: string;
  start: number; end: number; guests: number; bookerType: 'member' | 'external'; team: string;
  name: string; email: string; phone: string; agreedWith: string; manageToken: string;
  rejectReason: string | null; internalNote: string; keyHandedOut: boolean; depositPaid: boolean;
  decidedBy: string | null; createdAt: number;
};

type Row = Record<string, unknown>;
const toBooking = (r: Row): Booking => ({
  id: r.id as string, number: r.number as string, status: r.status as Status, categoryId: r.category_id as string,
  title: r.title as string, note: r.note as string, start: +(r.starts_at as Date), end: +(r.ends_at as Date),
  guests: r.guests as number, bookerType: r.booker_type as Booking['bookerType'], team: r.team as string,
  name: r.name as string, email: r.email as string, phone: r.phone as string, agreedWith: r.agreed_with as string,
  manageToken: r.manage_token as string, rejectReason: (r.reject_reason as string) ?? null,
  internalNote: r.internal_note as string, keyHandedOut: r.key_handed_out as boolean, depositPaid: r.deposit_paid as boolean,
  decidedBy: (r.decided_by as string) ?? null, createdAt: +(r.created_at as Date),
});
const toCategory = (r: Row): Category => ({
  id: r.id as string, name: r.name as string, hint: r.hint as string, color: r.color as string,
  bufferBefore: r.buffer_before_min as number, bufferAfter: r.buffer_after_min as number,
  requiresApproval: r.requires_approval as boolean, isParty: r.is_party as boolean,
  maxDurationMin: r.max_duration_min as number, sort: r.sort as number,
});

type Q = postgres.Sql | postgres.TransactionSql;
const token = () => randomBytes(24).toString('base64url');

// ---------- Stammdaten ----------
export async function getCategories(q: Q = db()): Promise<Category[]> {
  return (await q`select * from categories order by sort`).map(toCategory);
}
export async function getSettings(q: Q = db()): Promise<Settings> {
  const rows = await q`select key, value from settings`;
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in s) s[r.key] = r.value;
  return s as Settings;
}
async function getSlots(q: Q, from: number, to: number): Promise<Slot[]> {
  const rows = await q`select id, category_id, starts_at, ends_at, status from bookings
    where status in ${q(ACTIVE_STATUSES)} and ends_at > ${new Date(from)} and starts_at < ${new Date(to)}`;
  return rows.map((r) => ({ id: r.id, categoryId: r.category_id, start: +r.starts_at, end: +r.ends_at, status: r.status }));
}
export async function getBlackouts(q: Q = db(), from = 0, to = Date.UTC(2100, 0, 1)): Promise<Blackout[]> {
  const rows = await q`select * from blackouts where ends_at > ${new Date(from)} and starts_at < ${new Date(to)} order by starts_at`;
  return rows.map((r) => ({ id: r.id, start: +r.starts_at, end: +r.ends_at, reason: r.reason }));
}

/** Öffentliche, anonyme Belegung für den Kalender (ohne Namen, Notizen, Kontaktdaten). */
export async function getPublicOccupancy(from: number, to: number) {
  const q = db();
  const [categories, settings, slots, blackouts] = await Promise.all([
    getCategories(q), getSettings(q), getSlots(q, from - 7 * DAY, to + 7 * DAY), getBlackouts(q, from, to),
  ]);
  return { categories, settings, slots: slots.map((s) => ({ ...s, id: s.id.slice(0, 8) })), blackouts };
}

// ---------- Buchung anlegen ----------
export type NewBooking = {
  categoryId: string; title: string; note: string; start: number; end: number; guests: number;
  bookerType: 'member' | 'external'; team: string; name: string; email: string; phone: string; agreedWith: string;
};
export type CreateResult = { ok: true; booking: Booking; verifyToken: string } | { ok: false; check: CheckResult };

export async function createBooking(b: NewBooking): Promise<CreateResult> {
  return db().begin(async (q) => {
    // Alle Buchungen nacheinander prüfen und speichern: verhindert Doppelbuchungen bei gleichzeitigen Klicks.
    await q`select pg_advisory_xact_lock(4242)`;
    const [categories, settings] = await Promise.all([getCategories(q), getSettings(q)]);
    const slots = await getSlots(q, b.start - 10 * DAY, b.end + 10 * DAY);
    const blackouts = await getBlackouts(q, b.start - DAY, b.end + DAY);
    const check = checkBooking(b, { categories, settings, slots, blackouts, now: Date.now() });
    if (check.level === 'block') return { ok: false as const, check };
    const cat = categories.find((c) => c.id === b.categoryId)!;
    const verifyToken = token();
    const [row] = await q`insert into bookings ${q({
      category_id: b.categoryId, title: b.title, note: b.note, starts_at: new Date(b.start), ends_at: new Date(b.end),
      guests: b.guests, booker_type: b.bookerType, team: b.team, name: b.name, email: b.email.toLowerCase(), phone: b.phone,
      agreed_with: b.agreedWith, party_weekend: partyWeekendOf(b.start, cat, settings), manage_token: token(), verify_token: verifyToken,
    })} returning *`;
    await q`insert into audit_log (actor, booking_id, action) values (${b.email}, ${row.id}, 'created')`;
    return { ok: true as const, booking: toBooking(row), verifyToken };
  });
}

/** E-Mail bestätigt: Anfrage wird aktiv. Mitglieder-Termine ohne Freigabepflicht werden direkt bestätigt. */
export async function verifyBooking(verifyToken: string): Promise<{ booking: Booking; fresh: boolean } | null> {
  const q = db();
  const [row] = await q`select * from bookings where verify_token = ${verifyToken}`;
  if (!row) return null;
  if (row.status !== 'pending_email') return { booking: toBooking(row), fresh: false };
  const [cat] = await q`select requires_approval from categories where id = ${row.category_id}`;
  const auto = !cat.requires_approval && row.booker_type === 'member';
  const [upd] = await q`update bookings set status = ${auto ? 'confirmed' : 'requested'}, verified_at = now(),
    decided_by = ${auto ? 'automatisch' : null}, decided_at = ${auto ? new Date() : null}
    where id = ${row.id} and status = 'pending_email' returning *`;
  if (!upd) return { booking: toBooking(row), fresh: false };
  await q`insert into audit_log (actor, booking_id, action) values (${row.email}, ${row.id}, ${auto ? 'verified+auto-confirmed' : 'verified'})`;
  return { booking: toBooking(upd), fresh: true };
}

export async function getBookingByToken(manageToken: string): Promise<Booking | null> {
  const [row] = await db()`select * from bookings where manage_token = ${manageToken}`;
  return row ? toBooking(row) : null;
}
export async function getBooking(id: string): Promise<Booking | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await db()`select * from bookings where id = ${id}`;
  return row ? toBooking(row) : null;
}

export async function cancelByBooker(manageToken: string): Promise<Booking | null> {
  const [row] = await db()`update bookings set status = 'cancelled' where manage_token = ${manageToken}
    and status in ${db()(ACTIVE_STATUSES)} and starts_at > now() returning *`;
  if (row) await db()`insert into audit_log (actor, booking_id, action) values (${row.email}, ${row.id}, 'cancelled-by-booker')`;
  return row ? toBooking(row) : null;
}

// ---------- Verwaltung ----------
export async function listBookings(opts: { status?: Status[]; from?: number; to?: number; limit?: number } = {}): Promise<Booking[]> {
  const q = db();
  const rows = await q`select * from bookings where true
    ${opts.status ? q`and status in ${q(opts.status)}` : q``}
    ${opts.from !== undefined ? q`and ends_at > ${new Date(opts.from)}` : q``}
    ${opts.to !== undefined ? q`and starts_at < ${new Date(opts.to)}` : q``}
    order by starts_at limit ${opts.limit ?? 500}`;
  return rows.map(toBooking);
}

/** Prüft eine vorhandene Anfrage gegen alle anderen aktiven Buchungen (für die Konfliktanzeige im Admin). */
export async function checkExisting(b: Booking): Promise<CheckResult> {
  const q = db();
  const [categories, settings, slots, blackouts] = await Promise.all([
    getCategories(q), getSettings(q), getSlots(q, b.start - 10 * DAY, b.end + 10 * DAY), getBlackouts(q, b.start - DAY, b.end + DAY),
  ]);
  return checkBooking(b, { categories, settings, slots, blackouts, now: Date.now(), ignoreId: b.id, asAdmin: true });
}

export async function decide(id: string, action: 'confirm' | 'reject' | 'cancel', actor: string, reason?: string): Promise<Booking | null> {
  const q = db();
  const next = { confirm: 'confirmed', reject: 'rejected', cancel: 'cancelled' }[action];
  const allowed = action === 'confirm' ? ['requested'] : ['requested', 'confirmed', 'pending_email'];
  const [row] = await q`update bookings set status = ${next}, decided_by = ${actor}, decided_at = now(),
    reject_reason = ${reason ?? null} where id = ${id} and status in ${q(allowed)} returning *`;
  if (row) await q`insert into audit_log (actor, booking_id, action, detail) values (${actor}, ${id}, ${action}, ${q.json({ reason: reason ?? null })})`;
  return row ? toBooking(row) : null;
}

export async function updateInternal(id: string, actor: string, f: { internalNote: string; keyHandedOut: boolean; depositPaid: boolean }) {
  const q = db();
  await q`update bookings set internal_note = ${f.internalNote}, key_handed_out = ${f.keyHandedOut}, deposit_paid = ${f.depositPaid} where id = ${id}`;
  await q`insert into audit_log (actor, booking_id, action, detail) values (${actor}, ${id}, 'internal-update', ${q.json(f)})`;
}

export async function getAudit(bookingId?: string, limit = 50) {
  const q = db();
  return q`select a.*, b.number, b.title from audit_log a left join bookings b on b.id = a.booking_id
    ${bookingId ? q`where a.booking_id = ${bookingId}` : q``} order by a.created_at desc limit ${limit}`;
}

export async function saveSettings(actor: string, settings: Partial<Settings>, cats: { id: string; before: number; after: number; approval: boolean }[]) {
  await db().begin(async (q) => {
    for (const [k, v] of Object.entries(settings)) {
      await q`insert into settings (key, value) values (${k}, ${q.json(v as postgres.JSONValue)}) on conflict (key) do update set value = excluded.value`;
    }
    for (const c of cats) {
      await q`update categories set buffer_before_min = ${c.before}, buffer_after_min = ${c.after}, requires_approval = ${c.approval} where id = ${c.id}`;
    }
    await q`insert into audit_log (actor, action, detail) values (${actor}, 'settings', ${q.json({ settings, cats } as unknown as postgres.JSONValue)})`;
  });
}

export async function addBlackout(actor: string, start: number, end: number, reason: string) {
  await db()`insert into blackouts (starts_at, ends_at, reason, created_by) values (${new Date(start)}, ${new Date(end)}, ${reason}, ${actor})`;
}
export async function deleteBlackout(id: string) {
  await db()`delete from blackouts where id = ${id}`;
}

// ---------- Team ----------
export type Admin = { id: string; email: string; name: string; role: 'admin' | 'manager' | 'viewer'; notify: boolean };
export async function listAdmins(): Promise<Admin[]> {
  return (await db()`select id, email, name, role, notify from admins order by name`) as unknown as Admin[];
}
export async function upsertAdmin(email: string, name: string, role: Admin['role'], notify: boolean) {
  await db()`insert into admins (email, name, role, notify) values (${email.toLowerCase()}, ${name}, ${role}, ${notify})
    on conflict (email) do update set name = excluded.name, role = excluded.role, notify = excluded.notify`;
}
export async function removeAdmin(id: string) {
  await db()`delete from admins where id = ${id}`;
}
export async function notifyRecipients(): Promise<string[]> {
  return (await db()`select email from admins where notify and role <> 'viewer'`).map((r) => r.email as string);
}
