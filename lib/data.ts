import 'server-only';
import { randomBytes } from 'node:crypto';
import type postgres from 'postgres';
import { db } from './db';
import {
  ACTIVE_STATUSES, Blackout, Category, CheckResult, DEFAULT_SETTINGS, Message, RecurringBlock, Settings, Slot, checkBooking, expandRecurring, partyWeekendOf,
} from './rules';
import { DAY } from './time';
import { DEFAULT_PAYMENT, type PaymentSettings } from './payment';

export type Status = 'pending_email' | 'requested' | 'confirmed' | 'rejected' | 'cancelled' | 'expired';
export type Booking = {
  id: string; number: string; status: Status; categoryId: string; title: string; note: string;
  start: number; end: number; guests: number; bookerType: 'member' | 'external'; team: string;
  name: string; email: string; phone: string; agreedWith: string; manageToken: string; equipment: string[];
  rejectReason: string | null; internalNote: string; decidedBy: string | null; createdAt: number;
  seriesId: string | null; createdBy: string | null; silent: boolean;
  rent: number; deposit: number; rentPaid: boolean; depositPaid: boolean; depositReturned: boolean; depositWithheld: number;
  keyHandedOut: boolean; handoverAt: number | null; handoverBy: string | null; meterStart: number | null;
  returnAt: number | null; returnBy: string | null; meterEnd: number | null; conditionOk: boolean | null; damageNote: string;
};

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const ts = (v: unknown) => (v ? +(v as Date) : null);
const toBooking = (r: Row): Booking => ({
  id: r.id as string, number: r.number as string, status: r.status as Status, categoryId: r.category_id as string,
  title: r.title as string, note: r.note as string, start: +(r.starts_at as Date), end: +(r.ends_at as Date),
  guests: r.guests as number, bookerType: r.booker_type as Booking['bookerType'], team: r.team as string,
  name: r.name as string, email: r.email as string, phone: r.phone as string, agreedWith: r.agreed_with as string,
  manageToken: r.manage_token as string, equipment: (r.equipment as string[]) ?? [], rejectReason: (r.reject_reason as string) ?? null,
  internalNote: r.internal_note as string, decidedBy: (r.decided_by as string) ?? null, createdAt: +(r.created_at as Date),
  seriesId: (r.series_id as string) ?? null, createdBy: (r.created_by as string) ?? null, silent: !!r.silent,
  rent: num(r.rent_eur), deposit: num(r.deposit_eur), rentPaid: !!r.rent_paid, depositPaid: !!r.deposit_paid, depositReturned: !!r.deposit_returned, depositWithheld: num(r.deposit_withheld_eur),
  keyHandedOut: !!r.key_handed_out, handoverAt: ts(r.handover_at), handoverBy: (r.handover_by as string) ?? null, meterStart: numOrNull(r.meter_start),
  returnAt: ts(r.return_at), returnBy: (r.return_by as string) ?? null, meterEnd: numOrNull(r.meter_end),
  conditionOk: (r.condition_ok as boolean | null) ?? null, damageNote: (r.damage_note as string) ?? '',
});
const toCategory = (r: Row): Category => ({
  id: r.id as string, name: r.name as string, hint: r.hint as string, color: r.color as string,
  bufferBefore: r.buffer_before_min as number, bufferAfter: r.buffer_after_min as number,
  requiresApproval: r.requires_approval as boolean, isParty: r.is_party as boolean,
  maxDurationMin: r.max_duration_min as number, sort: r.sort as number,
});

type Q = postgres.Sql | postgres.TransactionSql;
const token = () => randomBytes(24).toString('base64url');
const audit = (q: Q, actor: string, bookingId: string | null, action: string, detail: object = {}) =>
  q`insert into audit_log (actor, booking_id, action, detail) values (${actor}, ${bookingId}, ${action}, ${q.json(detail as postgres.JSONValue)})`;

// ---------- Stammdaten ----------
export async function getCategories(q: Q = db()): Promise<Category[]> {
  return (await q`select * from categories order by sort`).map(toCategory);
}
async function settingsRows(q: Q) {
  const out: Record<string, unknown> = {};
  for (const r of await q`select key, value from settings`) out[r.key] = r.value;
  return out;
}
export async function getSettings(q: Q = db()): Promise<Settings> {
  const rows = await settingsRows(q);
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(s)) if (k in rows) s[k] = rows[k];
  return s as Settings;
}

export type Fees = { rent: number; deposit: number };
export type MailTextKey = 'confirmed' | 'rejected' | 'reminder' | 'followup' | 'received';
export type Operator = { name: string; address: string; email: string; phone: string; responsible: string };
export type Extras = { payment: PaymentSettings; equipment: string[]; feesExternal: Fees; feesMemberParty: Fees; mailTexts: Partial<Record<MailTextKey, string>>; contactNote: string; operator: Operator };
export const operatorComplete = (o: Operator) => !!(o.name.trim() && o.address.trim() && o.email.trim());
export async function getExtras(q: Q = db()): Promise<Extras> {
  const r = await settingsRows(q);
  return {
    equipment: (r.equipment as string[]) ?? [],
    feesExternal: (r.feesExternal as Fees) ?? { rent: 0, deposit: 0 },
    feesMemberParty: (r.feesMemberParty as Fees) ?? { rent: 0, deposit: 0 },
    mailTexts: (r.mailTexts as Extras['mailTexts']) ?? {},
    contactNote: (r.contactNote as string) ?? '',
    payment: { ...DEFAULT_PAYMENT, ...((r.payment as Partial<PaymentSettings>) ?? {}) },
    operator: { name: '', address: '', email: '', phone: '', responsible: '', ...((r.operator as Partial<Operator>) ?? {}) },
  };
}
/** Miete und Kaution, die für eine Anfrage gelten (Externe immer, Mitglieder nur bei Feiern). */
export function feesFor(x: Extras, bookerType: 'member' | 'external', isParty: boolean): Fees {
  if (bookerType === 'external') return x.feesExternal;
  return isParty ? x.feesMemberParty : { rent: 0, deposit: 0 };
}

async function getSlots(q: Q, from: number, to: number): Promise<Slot[]> {
  const rows = await q`select id, category_id, starts_at, ends_at, status from bookings
    where status in ${q(ACTIVE_STATUSES)} and ends_at > ${new Date(from)} and starts_at < ${new Date(to)}`;
  return rows.map((r) => ({ id: r.id, categoryId: r.category_id, start: +r.starts_at, end: +r.ends_at, status: r.status }));
}
export async function getBlackouts(q: Q = db(), from = 0, to = Date.UTC(2100, 0, 1)): Promise<Blackout[]> {
  const rows = await q`select * from blackouts where ends_at > ${new Date(from)} and starts_at < ${new Date(to)} order by starts_at`;
  return rows.map((r) => ({ id: r.id, start: +r.starts_at, end: +r.ends_at, reason: r.reason, scope: r.scope }));
}

// ---------- Regelmäßige Sperren ----------
const ymdOrNull = (d: unknown) => (d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : null);
export async function getRecurring(q: Q = db()): Promise<RecurringBlock[]> {
  const rows = await q`select id, weekdays, from_time, to_time, scope, reason, valid_from::text as valid_from, valid_until::text as valid_until from recurring_blocks order by created_at`;
  return rows.map((r) => ({ id: r.id, weekdays: r.weekdays, fromTime: r.from_time, toTime: r.to_time, scope: r.scope, reason: r.reason, validFrom: ymdOrNull(r.valid_from), validUntil: ymdOrNull(r.valid_until) }));
}
export async function addRecurring(actor: string, r: Omit<RecurringBlock, 'id'>) {
  await db()`insert into recurring_blocks (weekdays, from_time, to_time, scope, reason, valid_from, valid_until, created_by)
    values (${r.weekdays}, ${r.fromTime}, ${r.toTime}, ${r.scope}, ${r.reason}, ${r.validFrom}, ${r.validUntil}, ${actor})`;
  await audit(db(), actor, null, 'recurring-added', r);
}
export async function deleteRecurring(actor: string, id: string) {
  await db()`delete from recurring_blocks where id = ${id}`;
  await audit(db(), actor, null, 'recurring-removed', { id });
}
/** Alle Sperren im Zeitraum: einzelne Sperrzeiten plus aufgelöste regelmäßige Sperren. */
export async function getAllBlocks(q: Q = db(), from: number, to: number): Promise<Blackout[]> {
  const [single, rec] = await Promise.all([getBlackouts(q, from, to), getRecurring(q)]);
  return [...single, ...expandRecurring(rec, from, to)].sort((a, b) => a.start - b.start);
}

/** Öffentliche, anonyme Belegung für den Kalender (ohne Namen, Notizen, Kontaktdaten). */
export async function getPublicOccupancy(from: number, to: number) {
  const q = db();
  const [categories, settings, slots, blackouts, extras] = await Promise.all([
    getCategories(q), getSettings(q), getSlots(q, from - 7 * DAY, to + 7 * DAY), getAllBlocks(q, from, to), getExtras(q),
  ]);
  return {
    categories, settings, blackouts, slots: slots.map((s) => ({ ...s, id: s.id.slice(0, 8) })),
    equipment: extras.equipment, feesExternal: extras.feesExternal, feesMemberParty: extras.feesMemberParty,
  };
}

// ---------- Buchung anlegen (öffentlich) ----------
export type NewBooking = {
  categoryId: string; title: string; note: string; start: number; end: number; guests: number; equipment: string[];
  bookerType: 'member' | 'external'; team: string; name: string; email: string; phone: string; agreedWith: string;
};
export type CreateResult = { ok: true; booking: Booking; verifyToken: string } | { ok: false; check: CheckResult };

async function lockedContext(q: postgres.TransactionSql, start: number, end: number) {
  await q`select pg_advisory_xact_lock(4242)`; // Buchungen nacheinander prüfen: keine Doppelbuchung bei gleichzeitigen Klicks
  const [categories, settings, extras] = await Promise.all([getCategories(q), getSettings(q), getExtras(q)]);
  const slots = await getSlots(q, start - 10 * DAY, end + 10 * DAY);
  const blackouts = await getAllBlocks(q, start - DAY, end + DAY);
  return { categories, settings, extras, slots, blackouts };
}

export async function createBooking(b: NewBooking): Promise<CreateResult> {
  return db().begin(async (q) => {
    const ctx = await lockedContext(q, b.start, b.end);
    const check = checkBooking(b, { ...ctx, now: Date.now() });
    if (check.level === 'block') return { ok: false as const, check };
    const cat = ctx.categories.find((c) => c.id === b.categoryId)!;
    const fees = feesFor(ctx.extras, b.bookerType, cat.isParty);
    const equipment = b.equipment.filter((e) => ctx.extras.equipment.includes(e));
    const verifyToken = token();
    const [row] = await q`insert into bookings ${q({
      category_id: b.categoryId, title: b.title, note: b.note, starts_at: new Date(b.start), ends_at: new Date(b.end),
      guests: b.guests, booker_type: b.bookerType, team: b.team, name: b.name, email: b.email.toLowerCase(), phone: b.phone,
      agreed_with: b.agreedWith, party_weekend: partyWeekendOf(b.start, cat, ctx.settings), manage_token: token(), verify_token: verifyToken,
      equipment, rent_eur: fees.rent, deposit_eur: fees.deposit,
    })} returning *`;
    await audit(q, b.email, row.id, 'created');
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
  await audit(q, row.email, row.id, auto ? 'verified+auto-confirmed' : 'verified');
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
  const q = db();
  const [row] = await q`update bookings set status = 'cancelled' where manage_token = ${manageToken}
    and status in ${q(ACTIVE_STATUSES)} and starts_at > now() returning *`;
  if (row) await audit(q, row.email, row.id, 'cancelled-by-booker');
  return row ? toBooking(row) : null;
}

// ---------- Admin: direkt eintragen (auch als Serie) ----------
/** Regeln, die ein Admin bewusst übergehen darf. Echte Überschneidungen bleiben immer gesperrt. */
const OVERRIDABLE = new Set(['buffer', 'party-weekend', 'blackout', 'duration', 'horizon', 'past']);
export type AdminNew = Omit<NewBooking, 'start' | 'end' | 'agreedWith'> & { agreedWith: string; slots: { start: number; end: number }[]; override: boolean; seriesRule?: string; silent: boolean };
export type AdminCreateResult = { created: Booking[]; skipped: { start: number; reasons: string[] }[]; seriesId: string | null };

export async function adminCreate(actor: string, b: AdminNew): Promise<AdminCreateResult> {
  return db().begin(async (q) => {
    const first = b.slots[0], last = b.slots[b.slots.length - 1];
    const ctx = await lockedContext(q, first.start, last.end);
    const cat = ctx.categories.find((c) => c.id === b.categoryId)!;
    let seriesId: string | null = null;
    if (b.seriesRule && b.slots.length > 1) [{ id: seriesId }] = await q`insert into series (rule, created_by) values (${b.seriesRule}, ${actor}) returning id`;
    const created: Booking[] = [], skipped: AdminCreateResult['skipped'] = [];
    const fees = feesFor(ctx.extras, b.bookerType, cat.isParty);
    for (const s of b.slots) {
      const check = checkBooking({ ...b, ...s }, { ...ctx, now: Date.now(), asAdmin: true });
      const blocking = check.messages.filter((m) => m.level === 'block' && !(b.override && OVERRIDABLE.has(m.code)));
      if (blocking.length) { skipped.push({ start: s.start, reasons: blocking.map((m) => m.text) }); continue; }
      const overridden = check.messages.filter((m) => m.level === 'block').map((m) => m.code);
      const pw = partyWeekendOf(s.start, cat, ctx.settings);
      const [row] = await q`insert into bookings ${q({
        status: 'confirmed', category_id: b.categoryId, title: b.title, note: b.note, starts_at: new Date(s.start), ends_at: new Date(s.end),
        guests: b.guests, booker_type: b.bookerType, team: b.team, name: b.name, email: b.email.toLowerCase(), phone: b.phone,
        agreed_with: b.agreedWith, party_weekend: overridden.includes('party-weekend') ? null : pw, manage_token: token(),
        equipment: b.equipment, created_by: actor, decided_by: actor, decided_at: new Date(), verified_at: new Date(), series_id: seriesId,
        rent_eur: fees.rent, deposit_eur: fees.deposit, silent: b.silent,
      })} returning *`;
      await audit(q, actor, row.id, 'admin-created', overridden.length ? { overridden } : {});
      created.push(toBooking(row));
      ctx.slots.push({ id: row.id, categoryId: b.categoryId, start: s.start, end: s.end, status: 'confirmed' });
    }
    return { created, skipped, seriesId };
  });
}

// ---------- Admin: Termin ändern / verschieben ----------
export type Change = { categoryId: string; title: string; start: number; end: number; guests: number; equipment: string[] };
export async function changeBooking(id: string, actor: string, c: Change, override: boolean):
  Promise<{ ok: true; booking: Booking; before: Booking } | { ok: false; messages: Message[] }> {
  return db().begin(async (q) => {
    const [cur] = await q`select * from bookings where id = ${id} for update`;
    if (!cur) return { ok: false as const, messages: [{ level: 'block' as const, code: 'missing', text: 'Buchung nicht gefunden.' }] };
    const before = toBooking(cur);
    const ctx = await lockedContext(q, c.start, c.end);
    const check = checkBooking({ ...c, guests: c.guests }, { ...ctx, now: Date.now(), ignoreId: id, asAdmin: true });
    const blocking = check.messages.filter((m) => m.level === 'block' && !(override && OVERRIDABLE.has(m.code)));
    if (blocking.length) return { ok: false as const, messages: blocking };
    const cat = ctx.categories.find((x) => x.id === c.categoryId)!;
    const overridden = check.messages.some((m) => m.code === 'party-weekend');
    const [row] = await q`update bookings set category_id = ${c.categoryId}, title = ${c.title}, starts_at = ${new Date(c.start)}, ends_at = ${new Date(c.end)},
      guests = ${c.guests}, equipment = ${c.equipment}, party_weekend = ${overridden ? null : partyWeekendOf(c.start, cat, ctx.settings)},
      reminded_3d_at = null, reminded_1d_at = null where id = ${id} returning *`;
    await audit(q, actor, id, 'changed', {
      from: { start: before.start, end: before.end, categoryId: before.categoryId, title: before.title },
      to: { start: c.start, end: c.end, categoryId: c.categoryId, title: c.title },
    });
    return { ok: true as const, booking: toBooking(row), before };
  });
}

// ---------- Admin: Entscheidungen, Interna, Übergabe, Kosten ----------
export async function decide(id: string, action: 'confirm' | 'reject' | 'cancel', actor: string, reason?: string): Promise<Booking | null> {
  const q = db();
  const next = { confirm: 'confirmed', reject: 'rejected', cancel: 'cancelled' }[action];
  const allowed = action === 'confirm' ? ['requested'] : ['requested', 'confirmed', 'pending_email'];
  const [row] = await q`update bookings set status = ${next}, decided_by = ${actor}, decided_at = now(),
    reject_reason = ${reason ?? null} where id = ${id} and status in ${q(allowed)} returning *`;
  if (row) await audit(q, actor, id, action, { reason: reason ?? null });
  return row ? toBooking(row) : null;
}

export async function cancelSeries(seriesId: string, actor: string, reason: string, fromTs: number): Promise<Booking[]> {
  const q = db();
  const rows = await q`update bookings set status = 'cancelled', decided_by = ${actor}, decided_at = now(), reject_reason = ${reason}
    where series_id = ${seriesId} and status in ${q(ACTIVE_STATUSES)} and starts_at >= ${new Date(fromTs)} returning *`;
  for (const r of rows) await audit(q, actor, r.id, 'cancel', { reason, series: true });
  return rows.map(toBooking);
}

/** Automatische Mails an den Bucher für diese Buchung (und ihre Serie) an- oder abschalten. */
export async function setSilent(id: string, actor: string, silent: boolean, wholeSeries: boolean) {
  const q = db();
  const [b] = await q`select series_id from bookings where id = ${id}`;
  if (wholeSeries && b?.series_id) await q`update bookings set silent = ${silent} where series_id = ${b.series_id}`;
  else await q`update bookings set silent = ${silent} where id = ${id}`;
  await audit(q, actor, id, silent ? 'mails-off' : 'mails-on', { series: wholeSeries });
}

export async function updateInternal(id: string, actor: string, internalNote: string) {
  const q = db();
  await q`update bookings set internal_note = ${internalNote} where id = ${id}`;
  await audit(q, actor, id, 'internal-note');
}

export type Handover = {
  keyHandedOut: boolean; handoverBy: string; meterStart: number | null;
  keyReturned: boolean; returnBy: string; meterEnd: number | null; conditionOk: boolean | null; damageNote: string;
};
export async function updateHandover(id: string, actor: string, h: Handover) {
  const q = db();
  await q`update bookings set key_handed_out = ${h.keyHandedOut},
    handover_at = case when ${h.keyHandedOut} then coalesce(handover_at, now()) else null end, handover_by = ${h.handoverBy || null}, meter_start = ${h.meterStart},
    return_at = case when ${h.keyReturned} then coalesce(return_at, now()) else null end, return_by = ${h.returnBy || null}, meter_end = ${h.meterEnd},
    condition_ok = ${h.conditionOk}, damage_note = ${h.damageNote} where id = ${id}`;
  await audit(q, actor, id, 'handover', h);
}

export type Money = { rent: number; deposit: number; rentPaid: boolean; depositPaid: boolean; depositReturned: boolean; depositWithheld: number };
export async function updateMoney(id: string, actor: string, m: Money) {
  const q = db();
  await q`update bookings set rent_eur = ${m.rent}, deposit_eur = ${m.deposit}, rent_paid = ${m.rentPaid}, deposit_paid = ${m.depositPaid},
    deposit_returned = ${m.depositReturned}, deposit_withheld_eur = ${m.depositWithheld} where id = ${id}`;
  await audit(q, actor, id, 'money', m);
}

// ---------- Listen, Suche, Export ----------
export type ListFilter = { status?: Status[]; from?: number; to?: number; limit?: number; categoryId?: string; search?: string; bookerType?: string };
export async function listBookings(f: ListFilter = {}): Promise<Booking[]> {
  const q = db();
  const like = f.search ? `%${f.search.replace(/[%_]/g, '')}%` : null;
  const rows = await q`select * from bookings where true
    ${f.status ? q`and status in ${q(f.status)}` : q``}
    ${f.from !== undefined ? q`and ends_at > ${new Date(f.from)}` : q``}
    ${f.to !== undefined ? q`and starts_at < ${new Date(f.to)}` : q``}
    ${f.categoryId ? q`and category_id = ${f.categoryId}` : q``}
    ${f.bookerType ? q`and booker_type = ${f.bookerType}` : q``}
    ${like ? q`and (title ilike ${like} or name ilike ${like} or team ilike ${like} or number ilike ${like} or email ilike ${like})` : q``}
    order by starts_at limit ${f.limit ?? 500}`;
  return rows.map(toBooking);
}
export async function listByEmail(email: string): Promise<Booking[]> {
  const rows = await db()`select * from bookings where lower(email) = ${email.trim().toLowerCase()} and status <> 'pending_email'
    and ends_at > now() - interval '12 months' order by starts_at desc limit 100`;
  return rows.map(toBooking);
}
export async function hasBookings(email: string): Promise<boolean> {
  const [r] = await db()`select 1 from bookings where lower(email) = ${email.trim().toLowerCase()} and status <> 'pending_email' limit 1`;
  return !!r;
}
export async function listSeries(seriesId: string): Promise<Booking[]> {
  return (await db()`select * from bookings where series_id = ${seriesId} order by starts_at`).map(toBooking);
}

/** Prüft eine vorhandene Anfrage gegen alle anderen aktiven Buchungen (für die Konfliktanzeige im Admin). */
export async function countRecentBookerMessages(bookingId: string): Promise<number> {
  const [r] = await db()`select count(*)::int as n from messages where booking_id = ${bookingId} and author_type = 'booker' and created_at > now() - interval '1 hour'`;
  return r.n;
}
export async function checkExisting(b: Booking): Promise<CheckResult> {
  const q = db();
  const [categories, settings, slots, blackouts] = await Promise.all([
    getCategories(q), getSettings(q), getSlots(q, b.start - 10 * DAY, b.end + 10 * DAY), getAllBlocks(q, b.start - DAY, b.end + DAY),
  ]);
  const r = checkBooking(b, { categories, settings, slots, blackouts, now: Date.now(), ignoreId: b.id, asAdmin: true });
  // Für bestehende Buchungen ist „liegt in der Vergangenheit“ kein Konflikt.
  const messages = r.messages.filter((m) => m.code !== 'past');
  return { ...r, messages, level: messages.some((m) => m.level === 'block') ? 'block' : messages.length ? 'warn' : 'ok' };
}

export async function getAudit(bookingId?: string, limit = 50) {
  const q = db();
  return q`select a.*, b.number, b.title from audit_log a left join bookings b on b.id = a.booking_id
    ${bookingId ? q`where a.booking_id = ${bookingId}` : q``} order by a.created_at desc limit ${limit}`;
}

// ---------- Einstellungen ----------
export async function saveSettings(actor: string, settings: Record<string, unknown>, cats: { id: string; before: number; after: number; approval: boolean }[]) {
  await db().begin(async (q) => {
    for (const [k, v] of Object.entries(settings)) {
      await q`insert into settings (key, value) values (${k}, ${q.json(v as postgres.JSONValue)}) on conflict (key) do update set value = excluded.value`;
    }
    for (const c of cats) {
      await q`update categories set buffer_before_min = ${c.before}, buffer_after_min = ${c.after}, requires_approval = ${c.approval} where id = ${c.id}`;
    }
    await audit(q, actor, null, 'settings', { keys: Object.keys(settings), cats: cats.length });
  });
}
export async function addBlackout(actor: string, start: number, end: number, reason: string, scope: 'all' | 'party' = 'all') {
  await db()`insert into blackouts (starts_at, ends_at, reason, created_by, scope) values (${new Date(start)}, ${new Date(end)}, ${reason}, ${actor}, ${scope})`;
  await audit(db(), actor, null, 'blackout-added', { start, end, reason, scope });
}
/** Aktive Buchungen, die in einer Sperrzeit liegen (sie bleiben gültig, das Team soll sie aber sehen). */
export async function bookingsDuring(start: number, end: number, scope: 'all' | 'party' = 'all'): Promise<Booking[]> {
  const q = db();
  const rows = await q`select b.* from bookings b join categories c on c.id = b.category_id
    where b.status in ${q(ACTIVE_STATUSES)} and b.starts_at < ${new Date(end)} and b.ends_at > ${new Date(start)}
    ${scope === 'party' ? q`and c.is_party` : q``} order by b.starts_at`;
  return rows.map(toBooking);
}
export async function deleteBlackout(actor: string, id: string): Promise<{ start: number; end: number } | null> {
  const [r] = await db()`delete from blackouts where id = ${id} returning starts_at, ends_at`;
  await audit(db(), actor, null, 'blackout-removed', { id });
  return r ? { start: +r.starts_at, end: +r.ends_at } : null;
}

// ---------- Feedback ----------
export type Feedback = { bookingId: string; rating: number; comment: string; damage: boolean; createdAt: number };
export async function getFeedback(bookingId: string): Promise<Feedback | null> {
  const [r] = await db()`select * from feedback where booking_id = ${bookingId}`;
  return r ? { bookingId: r.booking_id, rating: r.rating, comment: r.comment, damage: r.damage, createdAt: +r.created_at } : null;
}
export async function saveFeedback(manageToken: string, rating: number, comment: string, damage: boolean): Promise<Booking | null> {
  const q = db();
  const [b] = await q`select * from bookings where manage_token = ${manageToken} and status = 'confirmed' and starts_at < now()`;
  if (!b) return null;
  await q`insert into feedback (booking_id, rating, comment, damage) values (${b.id}, ${rating}, ${comment}, ${damage})
    on conflict (booking_id) do update set rating = excluded.rating, comment = excluded.comment, damage = excluded.damage, created_at = now()`;
  await audit(q, b.email, b.id, 'feedback', { rating, damage });
  return toBooking(b);
}
export async function listFeedback(limit = 100) {
  return db()`select f.*, b.number, b.title, b.name, b.starts_at, b.category_id from feedback f join bookings b on b.id = f.booking_id order by f.created_at desc limit ${limit}`;
}

// ---------- Statistik ----------
export async function getStats(fromTs: number, toTs: number) {
  const q = db();
  const range = q`status = 'confirmed' and starts_at >= ${new Date(fromTs)} and starts_at < ${new Date(toTs)}`;
  const [months, cats, types, teams, totals, fb] = await Promise.all([
    q`select to_char(starts_at at time zone 'Europe/Berlin', 'YYYY-MM') as month, count(*)::int as n,
        round(sum(extract(epoch from ends_at - starts_at)) / 3600)::int as hours from bookings where ${range} group by 1 order by 1`,
    q`select category_id, count(*)::int as n from bookings where ${range} group by 1`,
    q`select booker_type, count(*)::int as n from bookings where ${range} group by 1`,
    q`select team, count(*)::int as n from bookings where ${range} and team <> '' group by 1 order by 2 desc limit 8`,
    q`select count(*)::int as n, coalesce(round(sum(extract(epoch from ends_at - starts_at)) / 3600), 0)::int as hours,
        coalesce(sum(rent_eur), 0)::float as rent, count(*) filter (where party_weekend is not null)::int as parties from bookings where ${range}`,
    q`select count(*)::int as n, coalesce(avg(rating), 0)::float as avg from feedback f join bookings b on b.id = f.booking_id where b.starts_at >= ${new Date(fromTs)}`,
  ]);
  const [rej] = await q`select count(*) filter (where status = 'rejected')::int as rejected, count(*) filter (where status in ('confirmed', 'rejected'))::int as decided
    from bookings where starts_at >= ${new Date(fromTs)} and starts_at < ${new Date(toTs)}`;
  return { months, cats, types, teams, totals: totals[0], feedback: fb[0], rejected: rej };
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

// ---------- Warteliste ----------
export type WaitEntry = { id: string; token: string; categoryId: string; start: number; end: number; name: string; email: string; notifiedAt: number | null; createdAt: number };
const toWait = (r: Row): WaitEntry => ({ id: r.id as string, token: r.token as string, categoryId: r.category_id as string, start: +(r.starts_at as Date), end: +(r.ends_at as Date),
  name: r.name as string, email: r.email as string, notifiedAt: ts(r.notified_at), createdAt: +(r.created_at as Date) });
export async function addWaitlist(e: { categoryId: string; start: number; end: number; name: string; email: string }): Promise<WaitEntry> {
  const q = db();
  const mail = e.email.trim().toLowerCase();
  // Doppelte Einträge für denselben Zeitraum vermeiden
  const [dup] = await q`select * from waitlist where email = ${mail} and starts_at = ${new Date(e.start)} and ends_at = ${new Date(e.end)} and notified_at is null`;
  if (dup) return toWait(dup);
  const [row] = await q`insert into waitlist (token, category_id, starts_at, ends_at, name, email) values (${token()}, ${e.categoryId}, ${new Date(e.start)}, ${new Date(e.end)}, ${e.name}, ${mail}) returning *`;
  return toWait(row);
}
export async function getWaitByToken(t: string): Promise<WaitEntry | null> {
  const [r] = await db()`select * from waitlist where token = ${t}`;
  return r ? toWait(r) : null;
}
export async function removeWait(t: string) { await db()`delete from waitlist where token = ${t}`; }
export async function removeWaitById(id: string) { await db()`delete from waitlist where id = ${id}`; }
export async function listWaitlist(): Promise<WaitEntry[]> {
  return (await db()`select * from waitlist where ends_at > now() order by starts_at`).map(toWait);
}
/**
 * Prüft nach einer Absage, welche Wartenden den Termin jetzt anfragen könnten,
 * markiert sie als benachrichtigt und gibt sie zurück (Versand macht notify.ts).
 */
export async function freeWaitlistFor(freedStart: number, freedEnd: number): Promise<WaitEntry[]> {
  const q = db();
  const rows = await q`select * from waitlist where notified_at is null and starts_at > now()
    and starts_at < ${new Date(freedEnd + 4 * DAY)} and ends_at > ${new Date(freedStart - 4 * DAY)} order by created_at`;
  if (!rows.length) return [];
  const entries = rows.map(toWait);
  const from = Math.min(...entries.map((e) => e.start)), to = Math.max(...entries.map((e) => e.end));
  const [categories, settings, slots, blackouts] = await Promise.all([
    getCategories(q), getSettings(q), getSlots(q, from - 10 * DAY, to + 10 * DAY), getAllBlocks(q, from - DAY, to + DAY),
  ]);
  const free: WaitEntry[] = [];
  for (const e of entries) {
    const r = checkBooking({ categoryId: e.categoryId, start: e.start, end: e.end, guests: 1 }, { categories, settings, slots, blackouts, now: Date.now() });
    if (r.level === 'block') continue;
    await q`update waitlist set notified_at = now() where id = ${e.id}`;
    free.push(e);
  }
  return free;
}

// ---------- Zahlungen ----------
export type Part = 'rent' | 'deposit';
export type Payment = { id: string; bookingId: string; provider: 'stripe' | 'manual'; amount: number; parts: Part[]; status: string;
  stripeSessionId: string | null; stripeIntentId: string | null; refunded: number; paidAt: number | null; createdAt: number };
const toPayment = (r: Row): Payment => ({ id: r.id as string, bookingId: r.booking_id as string, provider: r.provider as Payment['provider'], amount: num(r.amount_eur),
  parts: (r.parts as Part[]) ?? [], status: r.status as string, stripeSessionId: (r.stripe_session_id as string) ?? null, stripeIntentId: (r.stripe_intent_id as string) ?? null,
  refunded: num(r.refunded_eur), paidAt: ts(r.paid_at), createdAt: +(r.created_at as Date) });

/** Was für eine Buchung noch offen ist (nur bestätigte Buchungen). */
export function amountsDue(b: Booking) {
  const rent = b.rentPaid ? 0 : b.rent, deposit = b.depositPaid ? 0 : b.deposit;
  const parts: Part[] = [...(rent > 0 ? ['rent' as const] : []), ...(deposit > 0 ? ['deposit' as const] : [])];
  return { rent, deposit, total: Math.round((rent + deposit) * 100) / 100, parts };
}
export async function createPayment(bookingId: string, provider: Payment['provider'], amount: number, parts: Part[], stripeSessionId: string | null) {
  await db()`insert into payments (booking_id, provider, amount_eur, parts, stripe_session_id) values (${bookingId}, ${provider}, ${amount}, ${parts}, ${stripeSessionId})`;
}
/** Zahlung als bezahlt verbuchen (idempotent). Gibt die Buchung zurück, wenn sich etwas geändert hat. */
export async function markStripePaid(sessionId: string, intentId: string | null): Promise<{ booking: Booking; payment: Payment } | null> {
  return db().begin(async (q) => {
    const [p] = await q`update payments set status = 'paid', paid_at = now(), stripe_intent_id = coalesce(${intentId}, stripe_intent_id)
      where stripe_session_id = ${sessionId} and status = 'open' returning *`;
    if (!p) return null;
    const parts = p.parts as Part[];
    const [b] = await q`update bookings set rent_paid = rent_paid or ${parts.includes('rent')}, deposit_paid = deposit_paid or ${parts.includes('deposit')}
      where id = ${p.booking_id} returning *`;
    await audit(q, 'Stripe', p.booking_id, 'paid-online', { amount: num(p.amount_eur), parts });
    return { booking: toBooking(b), payment: toPayment(p) };
  });
}
export async function listPayments(bookingId: string): Promise<Payment[]> {
  return (await db()`select * from payments where booking_id = ${bookingId} order by created_at desc`).map(toPayment);
}
export async function getPayment(id: string): Promise<Payment | null> {
  const [r] = await db()`select * from payments where id = ${id}`;
  return r ? toPayment(r) : null;
}
export async function recordRefund(paymentId: string, actor: string, amount: number) {
  const q = db();
  const [p] = await q`update payments set refunded_eur = refunded_eur + ${amount},
    status = case when refunded_eur + ${amount} >= amount_eur then 'refunded' else 'partially_refunded' end where id = ${paymentId} returning *`;
  await audit(q, actor, p.booking_id, 'refund', { amount });
}

// ---------- Nachrichten ----------
export type ChatMessage = { id: number; bookingId: string; authorType: 'booker' | 'team'; authorName: string; body: string; teamReadAt: number | null; createdAt: number };
const toMessage = (r: Row): ChatMessage => ({ id: Number(r.id), bookingId: r.booking_id as string, authorType: r.author_type as ChatMessage['authorType'], authorName: r.author_name as string,
  body: r.body as string, teamReadAt: ts(r.team_read_at), createdAt: +(r.created_at as Date) });
export async function listMessages(bookingId: string): Promise<ChatMessage[]> {
  return (await db()`select * from messages where booking_id = ${bookingId} order by created_at`).map(toMessage);
}
export async function addMessage(bookingId: string, authorType: ChatMessage['authorType'], authorName: string, body: string): Promise<ChatMessage> {
  const q = db();
  const [r] = await q`insert into messages (booking_id, author_type, author_name, body, team_read_at)
    values (${bookingId}, ${authorType}, ${authorName}, ${body}, ${authorType === 'team' ? new Date() : null}) returning *`;
  await audit(q, authorName, bookingId, authorType === 'team' ? 'message-team' : 'message-booker');
  return toMessage(r);
}
export async function markMessagesRead(bookingId: string) {
  await db()`update messages set team_read_at = now() where booking_id = ${bookingId} and author_type = 'booker' and team_read_at is null`;
}
export async function unreadMessages() {
  return db()`select m.booking_id, b.title, b.name, count(*)::int as n, max(m.created_at) as last from messages m join bookings b on b.id = m.booking_id
    where m.author_type = 'booker' and m.team_read_at is null group by 1, 2, 3 order by last desc`;
}
