import 'server-only';
import { randomBytes } from 'node:crypto';
import type postgres from 'postgres';
import { db } from './db';
import {
  ACTIVE_STATUSES, Blackout, Category, CheckResult, DEFAULT_SETTINGS, Message, RecurringBlock, Settings, Slot, checkBooking, expandRecurring, partyWeekendOf,
} from './rules';
import { DAY } from './time';

export type Status = 'pending_email' | 'requested' | 'confirmed' | 'rejected' | 'cancelled' | 'expired';
export type Booking = {
  id: string; number: string; status: Status; categoryId: string; title: string; note: string;
  start: number; end: number; guests: number; bookerType: 'member' | 'external'; team: string;
  name: string; email: string; phone: string; agreedWith: string; manageToken: string; equipment: string[];
  rejectReason: string | null; internalNote: string; decidedBy: string | null; createdAt: number;
  seriesId: string | null; createdBy: string | null; silent: boolean;
  rent: number; deposit: number; rentPaid: boolean; depositReturned: boolean; depositWithheld: number;
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
  rent: num(r.rent_eur), deposit: num(r.deposit_eur), rentPaid: !!r.rent_paid, depositReturned: !!r.deposit_returned, depositWithheld: num(r.deposit_withheld_eur),
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
export type Extras = { equipment: string[]; feesExternal: Fees; feesMemberParty: Fees; mailTexts: Partial<Record<MailTextKey, string>>; contactNote: string };
export async function getExtras(q: Q = db()): Promise<Extras> {
  const r = await settingsRows(q);
  return {
    equipment: (r.equipment as string[]) ?? [],
    feesExternal: (r.feesExternal as Fees) ?? { rent: 0, deposit: 0 },
    feesMemberParty: (r.feesMemberParty as Fees) ?? { rent: 0, deposit: 0 },
    mailTexts: (r.mailTexts as Extras['mailTexts']) ?? {},
    contactNote: (r.contactNote as string) ?? '',
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

export type Money = { rent: number; deposit: number; rentPaid: boolean; depositReturned: boolean; depositWithheld: number };
export async function updateMoney(id: string, actor: string, m: Money) {
  const q = db();
  await q`update bookings set rent_eur = ${m.rent}, deposit_eur = ${m.deposit}, rent_paid = ${m.rentPaid},
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
export async function listSeries(seriesId: string): Promise<Booking[]> {
  return (await db()`select * from bookings where series_id = ${seriesId} order by starts_at`).map(toBooking);
}

/** Prüft eine vorhandene Anfrage gegen alle anderen aktiven Buchungen (für die Konfliktanzeige im Admin). */
export async function checkExisting(b: Booking): Promise<CheckResult> {
  const q = db();
  const [categories, settings, slots, blackouts] = await Promise.all([
    getCategories(q), getSettings(q), getSlots(q, b.start - 10 * DAY, b.end + 10 * DAY), getAllBlocks(q, b.start - DAY, b.end + DAY),
  ]);
  return checkBooking(b, { categories, settings, slots, blackouts, now: Date.now(), ignoreId: b.id, asAdmin: true });
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
export async function deleteBlackout(actor: string, id: string) {
  await db()`delete from blackouts where id = ${id}`;
  await audit(db(), actor, null, 'blackout-removed', { id });
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
