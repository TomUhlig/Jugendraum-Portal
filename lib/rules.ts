// Buchungsregeln. Läuft identisch im Browser (Live-Prüfung) und auf dem Server (verbindliche Prüfung).
import { DAY, HOUR, MIN, addDays, berlinHm, berlinParts, berlinToUtc, berlinYmd, fmtDay, weekdayOf, weekendKey, weekendLabel } from './time';

export type Category = {
  id: string;
  name: string;
  hint: string;
  color: string;
  bufferBefore: number; // Minuten
  bufferAfter: number;
  requiresApproval: boolean; // false = Mitglieder werden automatisch bestätigt
  isParty: boolean;
  maxDurationMin: number;
  sort: number;
};

export type Settings = {
  partyBlocksWholeWeekend: boolean;
  partyMinLeadDays: number;
  minLeadHours: number;
  horizonDays: number;
  capacity: number;
  partyLatestEnd: string; // "01:00"
  weekendFromHour: number; // Freitag ab
  weekendUntilHour: number; // Montag bis
};

export const DEFAULT_SETTINGS: Settings = {
  partyBlocksWholeWeekend: false,
  partyMinLeadDays: 14,
  minLeadHours: 24,
  horizonDays: 270,
  capacity: 40,
  partyLatestEnd: '01:00',
  weekendFromHour: 12,
  weekendUntilHour: 6,
};

export type ActiveStatus = 'pending_email' | 'requested' | 'confirmed';
export const ACTIVE_STATUSES: ActiveStatus[] = ['pending_email', 'requested', 'confirmed'];

export type Slot = { id: string; categoryId: string; start: number; end: number; status: ActiveStatus };
/** Sperrzeit. scope 'party' sperrt nur Feiern, 'all' jede Anfrage. */
export type Blackout = { id: string; start: number; end: number; reason: string; scope?: 'all' | 'party' };
export type Draft = { categoryId: string; start: number; end: number; guests: number };
export type Level = 'ok' | 'warn' | 'block';
export type Message = { level: Exclude<Level, 'ok'>; code: string; text: string };
export type Suggestion = { label: string; start: number; end: number };
export type CheckResult = { level: Level; messages: Message[]; suggestion: Suggestion | null };

export type Context = {
  categories: Category[];
  settings: Settings;
  slots: Slot[];
  blackouts: Blackout[];
  now: number;
  ignoreId?: string;
  /** Admins dürfen Vorlauf- und Horizont-Regeln übergehen. */
  asAdmin?: boolean;
};

/** Mindestabstand zwischen zwei Terminen: der größere der beiden Puffer, nicht die Summe. */
export function requiredGap(earlier: Category, later: Category): number {
  return Math.max(earlier.bufferAfter, later.bufferBefore) * MIN;
}

export function partyWeekendOf(start: number, cat: Category | undefined, s: Settings): string | null {
  return cat?.isParty ? weekendKey(start, s.weekendFromHour, s.weekendUntilHour) : null;
}

export function checkBooking(d: Draft, ctx: Context): CheckResult {
  const { categories, settings: s, now } = ctx;
  const cats = new Map(categories.map((c) => [c.id, c]));
  const c = cats.get(d.categoryId);
  const messages: Message[] = [];
  let suggestion: Suggestion | null = null;
  const add = (level: Message['level'], code: string, text: string) => messages.push({ level, code, text });

  if (!c) return { level: 'block', messages: [{ level: 'block', code: 'category', text: 'Bitte wähle eine Kategorie.' }], suggestion };
  if (!(d.end > d.start)) return { level: 'block', messages: [{ level: 'block', code: 'range', text: 'Das Ende muss nach dem Beginn liegen.' }], suggestion };

  const duration = d.end - d.start;
  if (d.start < now) add('block', 'past', 'Der Zeitpunkt liegt in der Vergangenheit.');
  if (duration > c.maxDurationMin * MIN) add('block', 'duration', `Für „${c.name}“ geht eine Buchung maximal ${c.maxDurationMin / 60} Stunden.`);
  if (!ctx.asAdmin && d.start > now + s.horizonDays * DAY) add('block', 'horizon', `Buchungen sind höchstens ${Math.round(s.horizonDays / 30)} Monate im Voraus möglich.`);

  // Sperrzeiten
  for (const b of ctx.blackouts) {
    if (b.scope === 'party' && !c.isParty) continue;
    // Sperrzeiten gelten für die gebuchte Zeit selbst ("ab 17 Uhr" heißt: Beginn 17:00 ist möglich)
    if (d.start < b.end && b.start < d.end) {
      add('block', 'blackout', blackoutText(b));
    }
  }

  // Überschneidungen inkl. Puffer
  for (const b of ctx.slots) {
    if (b.id === ctx.ignoreId) continue;
    const bc = cats.get(b.categoryId);
    if (!bc) continue;
    const gapAfterB = requiredGap(bc, c);
    const gapBeforeB = requiredGap(c, bc);
    const free = d.start >= b.end + gapAfterB || d.end + gapBeforeB <= b.start;
    if (free) continue;
    const when = `${fmtDay(b.start)} ${berlinHm(b.start)}–${berlinHm(b.end)}`;
    const core = d.start < b.end && b.start < d.end;
    if (core) add('block', 'overlap', `Belegt: ${when} (${b.status === 'confirmed' ? 'gebucht' : 'angefragt'}).`);
    else add('block', 'buffer', `Zu nah an einem Termin (${when}). Dazwischen braucht es ${Math.max(gapAfterB, gapBeforeB) / MIN} Minuten für Auf- und Abbau.`);
    if (!suggestion && d.start >= b.start) {
      const start = b.end + gapAfterB;
      suggestion = { label: `Auf ${berlinHm(start)} Uhr verschieben`, start, end: start + duration };
    }
  }

  // Eine Party pro Wochenende
  const key = weekendKey(d.start, s.weekendFromHour, s.weekendUntilHour);
  if (key) {
    const partyThatWeekend = ctx.slots.find((b) => b.id !== ctx.ignoreId && partyWeekendOf(b.start, cats.get(b.categoryId), s) === key);
    if (partyThatWeekend && (c.isParty || s.partyBlocksWholeWeekend)) {
      add('block', 'party-weekend', c.isParty
        ? `Am Wochenende ${weekendLabel(key)} ist schon eine Feier eingetragen. Pro Wochenende gibt es nur eine Party.`
        : `Das Wochenende ${weekendLabel(key)} ist wegen einer Feier komplett gesperrt.`);
      if (c.isParty) {
        const taken = new Set(ctx.slots.filter((b) => b.id !== ctx.ignoreId).map((b) => partyWeekendOf(b.start, cats.get(b.categoryId), s)).filter(Boolean));
        for (let w = 1; w <= 52; w++) {
          if (!taken.has(addDays(key, 7 * w))) {
            const shift = 7 * w * DAY; // Sommerzeit-Wechsel verschiebt höchstens um eine Stunde; wird beim Absenden erneut geprüft
            suggestion = { label: `Nächstes freies Party-Wochenende: ${weekendLabel(addDays(key, 7 * w))}`, start: d.start + shift, end: d.end + shift };
            break;
          }
        }
      }
    }
  }

  // Hinweise (blockieren nicht)
  if (c.isParty && !key) add('warn', 'party-weekday', 'Feiern unter der Woche nur nach besonderer Absprache (Nachbarschaft).');
  if (!ctx.asAdmin && d.start > now) {
    if (c.isParty && d.start - now < s.partyMinLeadDays * DAY) add('warn', 'lead', `Feiern bitte mindestens ${s.partyMinLeadDays} Tage vorher anfragen. Kurzfristig nur nach Rücksprache.`);
    else if (!c.isParty && d.start - now < s.minLeadHours * HOUR) add('warn', 'lead', `Bitte mindestens ${s.minLeadHours} Stunden vorher anfragen. Kurzfristig nur nach Rücksprache.`);
  }
  if (d.guests > s.capacity) add('warn', 'capacity', `Der Raum ist für höchstens ${s.capacity} Personen zugelassen (angegeben: ${d.guests}).`);
  if (c.isParty && endsTooLate(d.end, s.partyLatestEnd)) add('warn', 'late', `Partys enden spätestens um ${s.partyLatestEnd} Uhr.`);

  const level: Level = messages.some((m) => m.level === 'block') ? 'block' : messages.length ? 'warn' : 'ok';
  return { level, messages, suggestion };
}

/**
 * Regelmäßige Sperre, z. B. „montags geschlossen“ oder „Mo–Fr bis 17 Uhr“.
 * weekdays: 0 = Sonntag … 6 = Samstag. Ohne Uhrzeiten ganztägig; endet die Zeit vor dem Beginn, gilt sie bis zum Folgetag.
 */
export type RecurringBlock = {
  id: string; weekdays: number[]; fromTime: string | null; toTime: string | null;
  scope: 'all' | 'party'; reason: string; validFrom: string | null; validUntil: string | null;
};
export const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Rechnet regelmäßige Sperren für einen Zeitraum in einzelne Sperrzeiten um. */
export function expandRecurring(rules: RecurringBlock[], from: number, to: number): Blackout[] {
  const out: Blackout[] = [];
  const first = addDays(berlinYmd(from), -1), last = berlinYmd(to);
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const wd = weekdayOf(d);
    for (const r of rules) {
      if (!r.weekdays.includes(wd) || (r.validFrom && d < r.validFrom) || (r.validUntil && d > r.validUntil)) continue;
      let start: number, end: number;
      if (r.fromTime && r.toTime) {
        start = berlinToUtc(d, r.fromTime);
        end = r.toTime > r.fromTime ? berlinToUtc(d, r.toTime) : berlinToUtc(addDays(d, 1), r.toTime);
      } else { start = berlinToUtc(d, '00:00'); end = berlinToUtc(addDays(d, 1), '00:00'); }
      if (end > from && start < to) out.push({ id: `${r.id}:${d}`, start, end, reason: r.reason, scope: r.scope });
    }
  }
  return out;
}

/** Kurzbeschreibung einer regelmäßigen Sperre, z. B. „Mo, Di · 00:00–17:00 Uhr“. */
export function describeRecurring(r: RecurringBlock): string {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const days = order.filter((d) => r.weekdays.includes(d));
  const dayText = days.length === 7 ? 'täglich' : days.join(',') === '1,2,3,4,5' ? 'Mo–Fr' : days.join(',') === '6,0' ? 'Sa und So' : days.map((d) => WEEKDAY_SHORT[d]).join(', ');
  const time = r.fromTime && r.toTime ? `${r.fromTime}–${r.toTime} Uhr` : 'ganztägig';
  return `${dayText} · ${time}`;
}

/** Zeitraum einer Sperrzeit, z. B. „Mo., 21. Dez.–So., 3. Jan.“ oder „Sa., 5. Dez. 14:00–18:00 Uhr“. */
export function blackoutWhen(b: Blackout): string {
  const fullDays = berlinHm(b.start) === '00:00' && berlinHm(b.end) === '00:00';
  const sameDay = fmtDay(b.start) === fmtDay(b.end - 1);
  if (fullDays) return sameDay ? fmtDay(b.start) : `${fmtDay(b.start)}–${fmtDay(b.end - 1)}`;
  return sameDay ? `${fmtDay(b.start)} ${berlinHm(b.start)}–${berlinHm(b.end)} Uhr` : `${fmtDay(b.start)} ${berlinHm(b.start)} bis ${fmtDay(b.end)} ${berlinHm(b.end)} Uhr`;
}
/** Hinweistext für Buchende. */
export function blackoutText(b: Blackout): string {
  return b.scope === 'party' ? `Feiern sind ${blackoutWhen(b)} nicht möglich: ${b.reason}.` : `Der Raum ist ${blackoutWhen(b)} gesperrt: ${b.reason}.`;
}

function endsTooLate(end: number, latest: string): boolean {
  const p = berlinParts(end);
  const [lh, lm] = latest.split(':').map(Number);
  const mins = p.hour * 60 + p.minute;
  return mins > lh * 60 + lm && p.hour < 8;
}
