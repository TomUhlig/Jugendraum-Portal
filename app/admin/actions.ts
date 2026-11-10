'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, sessionCookie } from '@/lib/auth';
import {
  Admin, MailTextKey, addBlackout, addMessage, getPayment, recordRefund, addRecurring, deleteRecurring, removeWaitById, adminCreate, cancelSeries, changeBooking, decide, deleteBlackout, getBooking, getCategories, getExtras,
  removeAdmin, saveSettings, setSilent, updateHandover, updateInternal, updateMoney, upsertAdmin,
} from '@/lib/data';
import { mailMode, mails, teamMails } from '@/lib/mail';
import { isValidIban, normalizeIban } from '@/lib/payment';
import { refund } from '@/lib/stripe';
import { afterDecision, notifyWaitlist } from '@/lib/notify';
import { Freq, describeSeries, seriesDates } from '@/lib/series';
import { addDays, berlinToUtc } from '@/lib/time';

const go = (url: string, key: 'ok' | 'fehler', msg: string): never => {
  const [path, hash] = url.split('#');
  return redirect(path + (path.includes('?') ? '&' : '?') + key + '=' + encodeURIComponent(msg) + (hash ? '#' + hash : ''));
};
const backOf = (fd: FormData, fallback = '/admin') => { const b = String(fd.get('back') ?? fallback); return b.startsWith('/admin') ? b : fallback; };
const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max);
const money = (fd: FormData, k: string) => Math.max(0, Math.round((Number(String(fd.get(k) ?? '0').replace(',', '.')) || 0) * 100) / 100);
const numOrNull = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? '').replace(',', '.').trim(); return v === '' || isNaN(+v) ? null : +v; };
const isDate = (s: string) => /^\d{4}-\d\d-\d\d$/.test(s);
const isTime = (s: string) => /^\d\d:\d\d$/.test(s);
function range(date: string, start: string, end: string) {
  const s = berlinToUtc(date, start);
  const e = end > start ? berlinToUtc(date, end) : berlinToUtc(addDays(date, 1), end);
  return { start: s, end: e };
}

// ---------- Entscheidungen ----------
export async function decideAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const id = str(fd, 'id', 40);
  const action = str(fd, 'action', 10) as 'confirm' | 'reject' | 'cancel';
  const reason = str(fd, 'reason', 600);
  if ((action === 'reject' || action === 'cancel') && reason.length < 3) go(`/admin/buchung/${id}`, 'fehler', 'Bitte gib eine kurze Begründung an. Sie steht in der Mail an den Bucher.');
  const b = await decide(id, action, admin.name, reason || undefined);
  if (!b) go(backOf(fd), 'fehler', 'Die Buchung wurde inzwischen schon bearbeitet.');
  await afterDecision(b!);
  revalidatePath('/admin', 'layout');
  go(backOf(fd), 'ok', { confirm: `„${b!.title}“ ist bestätigt.`, reject: `„${b!.title}“ wurde abgelehnt.`, cancel: `„${b!.title}“ wurde storniert.` }[action] + (b!.silent ? ' Es wurde keine Mail verschickt.' : ` ${b!.name} wird per Mail informiert.`));
}

export async function cancelSeriesAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const seriesId = str(fd, 'seriesId', 40), id = str(fd, 'id', 40), reason = str(fd, 'reason', 600);
  if (reason.length < 3) go(`/admin/buchung/${id}`, 'fehler', 'Bitte gib eine kurze Begründung an.');
  const from = Number(fd.get('from')) || Date.now();
  const list = await cancelSeries(seriesId, admin.name, reason, from);
  if (fd.get('notify') === 'on' && list[0]) {
    const cat = (await getCategories()).find((c) => c.id === list[0].categoryId);
    await mails.cancelled(list[0], cat).catch(() => {});
  }
  await notifyWaitlist(list);
  revalidatePath('/admin', 'layout');
  go(`/admin/buchung/${id}`, 'ok', `${list.length} Termine der Serie storniert.`);
}

// ---------- Neu anlegen (auch Serie) ----------
export async function createAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const date = str(fd, 'date', 10), start = str(fd, 'start', 5), end = str(fd, 'end', 5);
  const categoryId = str(fd, 'categoryId', 20), title = str(fd, 'title', 80);
  if (!isDate(date) || !isTime(start) || !isTime(end) || !categoryId || title.length < 2) go('/admin/neu', 'fehler', 'Bitte Art, Titel, Datum und Uhrzeit angeben.');
  const repeat = str(fd, 'repeat', 10) as Freq | 'none';
  let dates = [date];
  let rule: string | undefined;
  if (repeat !== 'none') {
    const until = str(fd, 'until', 10), count = Number(fd.get('count')) || undefined;
    if (!isDate(until) && !count) go('/admin/neu', 'fehler', 'Für eine Serie bitte ein Enddatum oder eine Anzahl angeben.');
    dates = seriesDates(date, repeat, { until: isDate(until) ? until : undefined, count }, 60);
    rule = describeSeries(date, repeat, start, end, dates.length);
  }
  const contactEmail = str(fd, 'email', 120);
  // Standard: Termine, die das Team für andere einträgt, lösen keine Mails aus (auch keine Erinnerungen).
  const mailMode = str(fd, 'mails', 10) || 'none';
  const silent = mailMode === 'none' || !contactEmail;
  const res = await adminCreate(admin.name, {
    categoryId, title, note: str(fd, 'note', 500), guests: Math.max(1, Number(fd.get('guests')) || 1),
    equipment: fd.getAll('equipment').map(String), bookerType: fd.get('bookerType') === 'external' ? 'external' : 'member',
    team: str(fd, 'team', 80), name: str(fd, 'name', 80) || admin.name, email: contactEmail || admin.email, phone: str(fd, 'phone', 40),
    agreedWith: str(fd, 'agreedWith', 40) || admin.name, override: fd.get('override') === 'on', seriesRule: rule, silent,
    slots: dates.map((d) => range(d, start, end)),
  });
  if (mailMode === 'confirm' && !silent && res.created[0]) {
    const cat = (await getCategories()).find((c) => c.id === categoryId);
    await mails.confirmed(res.created[0], cat).catch(() => {});
  }
  revalidatePath('/admin', 'layout'); revalidatePath('/');
  if (!res.created.length) go('/admin/neu', 'fehler', 'Kein Termin angelegt: ' + (res.skipped[0]?.reasons[0] ?? 'unbekannter Fehler'));
  const skippedNote = res.skipped.length ? ` ${res.skipped.length} Termin(e) übersprungen, siehe Verlauf.` : '';
  const target = `/admin/buchung/${res.created[0].id}`;
  const skippedParam = res.skipped.length ? `?uebersprungen=${encodeURIComponent(JSON.stringify(res.skipped.map((s) => [s.start, s.reasons[0]])))}` : '';
  const mailNote = silent ? ' Es wurden keine E-Mails verschickt.' : mailMode === 'confirm' ? ` Bestätigung an ${contactEmail} gesendet.` : ' Erinnerungen gehen an die angegebene Adresse.';
  go(target + skippedParam, 'ok', (res.created.length > 1 ? `${res.created.length} Termine eingetragen.` : 'Termin eingetragen.') + mailNote + skippedNote);
}

// ---------- Ändern / verschieben ----------
export async function changeAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const id = str(fd, 'id', 40);
  const date = str(fd, 'date', 10), start = str(fd, 'start', 5), end = str(fd, 'end', 5);
  if (!isDate(date) || !isTime(start) || !isTime(end)) go(`/admin/buchung/${id}?bearbeiten=1`, 'fehler', 'Bitte Datum und Uhrzeit prüfen.');
  const r = range(date, start, end);
  const res = await changeBooking(id, admin.name, {
    categoryId: str(fd, 'categoryId', 20), title: str(fd, 'title', 80), guests: Math.max(1, Number(fd.get('guests')) || 1),
    equipment: fd.getAll('equipment').map(String), ...r,
  }, fd.get('override') === 'on');
  if (!res.ok) go(`/admin/buchung/${id}?bearbeiten=1`, 'fehler', res.messages.map((m) => m.text).join(' '));
  const moved = res.ok && (res.before.start !== res.booking.start || res.before.end !== res.booking.end);
  if (moved && res.ok) await notifyWaitlist([res.before]);
  if (res.ok && fd.get('notify') === 'on' && ['confirmed', 'requested'].includes(res.booking.status)) {
    const cat = (await getCategories()).find((c) => c.id === res.booking.categoryId);
    await mails.changed(res.booking, res.before, cat, str(fd, 'message', 500) || undefined).catch(() => {});
  }
  revalidatePath('/admin', 'layout'); revalidatePath('/');
  const informed = fd.get('notify') === 'on' && res.ok && !res.booking.silent;
  go(`/admin/buchung/${id}`, 'ok', (moved ? 'Termin verschoben.' : 'Änderungen gespeichert.') + (informed ? ' Der Bucher wurde informiert.' : ''));
}

export async function silentAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const id = str(fd, 'id', 40);
  const silent = fd.get('silent') === '1';
  await setSilent(id, admin.name, silent, fd.get('series') === 'on');
  go(`/admin/buchung/${id}`, 'ok', silent ? 'Für diese Buchung werden keine automatischen Mails mehr verschickt.' : 'Automatische Mails (Erinnerungen, Änderungen) sind wieder an.');
}

/** Verschieben per Drag & Drop im Kalender. Gibt eine Meldung zurück statt umzuleiten. */
export async function moveAction(id: string, start: number, end: number, notify: boolean): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin('manager');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { ok: false, message: 'Ungültige Zeit.' };
  const b = await getBooking(id);
  if (!b) return { ok: false, message: 'Buchung nicht gefunden.' };
  const res = await changeBooking(id, admin.name, { categoryId: b.categoryId, title: b.title, guests: b.guests, equipment: b.equipment, start, end }, false);
  if (!res.ok) return { ok: false, message: res.messages.map((m) => m.text).join(' ') };
  await notifyWaitlist([res.before]);
  const informed = notify && !res.booking.silent && ['confirmed', 'requested'].includes(res.booking.status);
  if (informed) {
    const cat = (await getCategories()).find((c) => c.id === res.booking.categoryId);
    await mails.changed(res.booking, res.before, cat).catch(() => {});
  }
  revalidatePath('/admin', 'layout'); revalidatePath('/');
  return { ok: true, message: `„${b.title}“ verschoben.${informed ? ` ${b.name} wurde per Mail informiert.` : ''}` };
}

// ---------- Interna, Übergabe, Kosten ----------
export async function noteAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const id = str(fd, 'id', 40);
  await updateInternal(id, admin.name, str(fd, 'internalNote', 2000));
  go(`/admin/buchung/${id}`, 'ok', 'Notiz gespeichert.');
}
export async function handoverAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const id = str(fd, 'id', 40);
  const cond = String(fd.get('condition') ?? '');
  await updateHandover(id, admin.name, {
    keyHandedOut: fd.get('keyHandedOut') === 'on', handoverBy: str(fd, 'handoverBy', 80), meterStart: numOrNull(fd, 'meterStart'),
    keyReturned: fd.get('keyReturned') === 'on', returnBy: str(fd, 'returnBy', 80), meterEnd: numOrNull(fd, 'meterEnd'),
    conditionOk: cond === 'ok' ? true : cond === 'issues' ? false : null, damageNote: str(fd, 'damageNote', 1000),
  });
  go(`/admin/buchung/${id}`, 'ok', 'Übergabeprotokoll gespeichert.');
}
export async function moneyAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const id = str(fd, 'id', 40);
  const b = await getBooking(id);
  const withheld = Math.min(money(fd, 'depositWithheld'), money(fd, 'deposit'));
  await updateMoney(id, admin.name, {
    rent: money(fd, 'rent'), deposit: money(fd, 'deposit'), rentPaid: fd.get('rentPaid') === 'on', depositPaid: fd.get('depositPaid') === 'on',
    depositReturned: fd.get('depositReturned') === 'on', depositWithheld: withheld,
  });
  go(`/admin/buchung/${id}`, 'ok', b ? 'Kosten gespeichert.' : 'Gespeichert.');
}

export async function refundAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const id = str(fd, 'id', 40);
  const p = await getPayment(str(fd, 'paymentId', 40));
  const amount = money(fd, 'amount');
  if (!p || p.bookingId !== id || !p.stripeIntentId) go(`/admin/buchung/${id}`, 'fehler', 'Zahlung nicht gefunden.');
  if (amount <= 0 || amount > p!.amount - p!.refunded) go(`/admin/buchung/${id}`, 'fehler', `Bitte einen Betrag zwischen 0 und ${(p!.amount - p!.refunded).toFixed(2)} € angeben.`);
  try { await refund(p!.stripeIntentId!, amount); } catch (e) { go(`/admin/buchung/${id}`, 'fehler', `Stripe hat die Erstattung abgelehnt: ${String((e as Error).message).slice(0, 160)}`); }
  await recordRefund(p!.id, admin.name, amount);
  const b = await getBooking(id);
  if (b) {
    await updateMoney(id, admin.name, { rent: b.rent, deposit: b.deposit, rentPaid: b.rentPaid, depositPaid: b.depositPaid, depositReturned: true, depositWithheld: Math.max(0, Math.round((b.deposit - amount) * 100) / 100) });
    await mails.depositRefunded(b, amount).catch(() => {});
  }
  go(`/admin/buchung/${id}`, 'ok', `${amount.toFixed(2).replace('.', ',')} € über Stripe erstattet.`);
}
export async function paymentSettingsAction(fd: FormData) {
  const admin = await requireAdmin('admin');
  const iban = str(fd, 'iban', 40);
  if (iban && !isValidIban(iban)) go('/admin/einstellungen#bezahlung', 'fehler', 'Die IBAN ist ungültig. Bitte prüfen.');
  await saveSettings(admin.name, { payment: {
    holder: str(fd, 'holder', 70), iban: normalizeIban(iban), bic: str(fd, 'bic', 11).toUpperCase(), paypalMe: str(fd, 'paypalMe', 80),
    dueDays: Math.min(60, Math.max(0, Math.round(Number(fd.get('dueDays')) || 0))), note: str(fd, 'note', 300),
    transfer: fd.get('transfer') === 'on', paypal: fd.get('paypal') === 'on', stripe: fd.get('stripe') === 'on',
  } }, []);
  revalidatePath('/', 'layout');
  go('/admin/einstellungen#bezahlung', 'ok', 'Bezahlung gespeichert.');
}

export async function messageAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const id = str(fd, 'id', 40);
  const body = String(fd.get('body') ?? '').trim().slice(0, 2000);
  if (body.length < 2) go(`/admin/buchung/${id}#nachrichten`, 'fehler', 'Bitte eine Nachricht eingeben.');
  const b = await getBooking(id);
  if (!b) go('/admin', 'fehler', 'Buchung nicht gefunden.');
  await addMessage(id, 'team', admin.name, body);
  const mail = fd.get('mail') === 'on';
  if (mail) await mails.message(b!, admin.name, body).catch(() => {});
  go(`/admin/buchung/${id}#nachrichten`, 'ok', mail ? `Nachricht gesendet, ${b!.name} bekommt sie per Mail.` : 'Nachricht gespeichert (ohne Mail).');
}

// ---------- Einstellungen ----------
export async function settingsAction(fd: FormData) {
  const admin = await requireAdmin('admin');
  const n = (k: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(fd.get(k)) || 0)));
  const latest = str(fd, 'partyLatestEnd', 5);
  const cats = (await getCategories()).map((c) => ({ id: c.id, before: n(`before_${c.id}`, 0, 600), after: n(`after_${c.id}`, 0, 720), approval: fd.get(`approval_${c.id}`) === 'on' }));
  await saveSettings(admin.name, {
    partyBlocksWholeWeekend: fd.get('partyBlocksWholeWeekend') === 'on', partyMinLeadDays: n('partyMinLeadDays', 0, 120), minLeadHours: n('minLeadHours', 0, 336),
    horizonDays: n('horizonDays', 14, 730), capacity: n('capacity', 1, 500), partyLatestEnd: isTime(latest) ? latest : '01:00',
  }, cats);
  revalidatePath('/', 'layout');
  go('/admin/einstellungen', 'ok', 'Regeln gespeichert.');
}
export async function offerAction(fd: FormData) {
  const admin = await requireAdmin('admin');
  const equipment = String(fd.get('equipment') ?? '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20).map((s) => s.slice(0, 60));
  await saveSettings(admin.name, {
    equipment, contactNote: str(fd, 'contactNote', 300),
    feesExternal: { rent: money(fd, 'extRent'), deposit: money(fd, 'extDeposit') },
    feesMemberParty: { rent: money(fd, 'memRent'), deposit: money(fd, 'memDeposit') },
  }, []);
  revalidatePath('/', 'layout');
  go('/admin/einstellungen#angebot', 'ok', 'Ausstattung und Kosten gespeichert.');
}
export async function operatorAction(fd: FormData) {
  const admin = await requireAdmin('admin');
  await saveSettings(admin.name, { operator: {
    name: str(fd, 'opName', 120), address: String(fd.get('opAddress') ?? '').trim().slice(0, 300), email: str(fd, 'opEmail', 120),
    phone: str(fd, 'opPhone', 40), responsible: str(fd, 'opResponsible', 200),
  } }, []);
  revalidatePath('/', 'layout');
  go('/admin/einstellungen#betreiber', 'ok', 'Betreiberangaben gespeichert. Impressum und Datenschutz sind aktualisiert.');
}
export async function testMailAction() {
  const admin = await requireAdmin('manager');
  if (mailMode() === 'console') go('/admin/einstellungen#mail', 'fehler', 'Es ist noch kein Mailversand eingerichtet (siehe Anleitung EINRICHTUNG.md, Schritt 4).');
  const ok = await teamMails.test(admin.email);
  go('/admin/einstellungen#mail', ok ? 'ok' : 'fehler', ok ? `Testmail an ${admin.email} verschickt. Schau in dein Postfach (auch im Spam).` : 'Die Testmail konnte nicht verschickt werden. Den Fehler findest du unter Protokoll → E-Mails.');
}

export async function textsAction(fd: FormData) {
  const admin = await requireAdmin('admin');
  const keys: MailTextKey[] = ['received', 'confirmed', 'rejected', 'reminder', 'followup'];
  const current = (await getExtras()).mailTexts;
  const next: Record<string, string> = { ...current };
  for (const k of keys) { const v = String(fd.get(`text_${k}`) ?? '').trim().slice(0, 1500); if (v) next[k] = v; else delete next[k]; }
  await saveSettings(admin.name, { mailTexts: next }, []);
  go('/admin/einstellungen#texte', 'ok', 'E-Mail-Texte gespeichert.');
}

export async function addBlackoutAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const from = str(fd, 'from', 10), to = str(fd, 'to', 10) || from, reason = str(fd, 'reason', 120) || 'Keine Buchungen möglich';
  const scope = fd.get('scope') === 'party' ? 'party' : 'all';
  const fromTime = str(fd, 'fromTime', 5), toTime = str(fd, 'toTime', 5);
  const back = backOf(fd, '/admin/sperrzeiten');
  if (!isDate(from) || !isDate(to) || to < from) go(back, 'fehler', 'Bitte einen gültigen Zeitraum wählen (bis nicht vor von).');
  let start = berlinToUtc(from, '00:00'), end = berlinToUtc(addDays(to, 1), '00:00');
  if (fd.get('hours') === 'on') {
    if (!isTime(fromTime) || !isTime(toTime)) go(back, 'fehler', 'Bitte Uhrzeiten angeben oder „nur bestimmte Uhrzeiten“ abwählen.');
    start = berlinToUtc(from, fromTime);
    end = toTime > fromTime || to > from ? berlinToUtc(to, toTime) : berlinToUtc(addDays(to, 1), toTime);
    if (end <= start) go(back, 'fehler', 'Das Ende muss nach dem Beginn liegen.');
  }
  await addBlackout(admin.name, start, end, reason, scope);
  revalidatePath('/', 'layout');
  go('/admin/sperrzeiten', 'ok', scope === 'party' ? 'Gesperrt für Feiern. Andere Termine bleiben möglich.' : 'Zeitraum gesperrt. Dort sind keine neuen Anfragen mehr möglich.');
}
export async function deleteBlackoutAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const freed = await deleteBlackout(admin.name, str(fd, 'id', 40));
  if (freed) await notifyWaitlist([freed]);
  revalidatePath('/', 'layout');
  go('/admin/sperrzeiten', 'ok', 'Sperrzeit gelöscht.');
}

export async function addRecurringAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const weekdays = [...new Set(fd.getAll('weekday').map(Number).filter((n) => n >= 0 && n <= 6))];
  const reason = str(fd, 'reason', 120);
  if (!weekdays.length) go('/admin/sperrzeiten#regelmaessig', 'fehler', 'Bitte mindestens einen Wochentag auswählen.');
  if (!reason) go('/admin/sperrzeiten#regelmaessig', 'fehler', 'Bitte einen Grund angeben, z. B. „Ruhetag“.');
  const hours = fd.get('hours') === 'on';
  const fromTime = str(fd, 'fromTime', 5), toTime = str(fd, 'toTime', 5);
  if (hours && (!isTime(fromTime) || !isTime(toTime) || fromTime === toTime)) go('/admin/sperrzeiten#regelmaessig', 'fehler', 'Bitte gültige Uhrzeiten angeben.');
  const validFrom = str(fd, 'validFrom', 10), validUntil = str(fd, 'validUntil', 10);
  if (validFrom && validUntil && validUntil < validFrom) go('/admin/sperrzeiten#regelmaessig', 'fehler', '„Gültig bis“ liegt vor „gültig ab“.');
  await addRecurring(admin.name, {
    weekdays, fromTime: hours ? fromTime : null, toTime: hours ? toTime : null, scope: fd.get('scope') === 'party' ? 'party' : 'all', reason,
    validFrom: isDate(validFrom) ? validFrom : null, validUntil: isDate(validUntil) ? validUntil : null,
  });
  revalidatePath('/', 'layout');
  go('/admin/sperrzeiten#regelmaessig', 'ok', 'Regelmäßige Sperre gespeichert. Sie gilt ab sofort auf der Buchungsseite.');
}
export async function deleteRecurringAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  await deleteRecurring(admin.name, str(fd, 'id', 40));
  await notifyWaitlist([{ start: Date.now(), end: Date.now() + 400 * 86400e3 }]);
  revalidatePath('/', 'layout');
  go('/admin/sperrzeiten#regelmaessig', 'ok', 'Regelmäßige Sperre aufgehoben.');
}

export async function removeWaitAction(fd: FormData) {
  await requireAdmin('manager');
  await removeWaitById(str(fd, 'id', 40));
  go('/admin/warteliste', 'ok', 'Eintrag entfernt.');
}

// ---------- Team ----------
export async function upsertAdminAction(fd: FormData) {
  await requireAdmin('admin');
  const email = str(fd, 'email', 120), name = str(fd, 'name', 80), role = str(fd, 'role', 10) as Admin['role'];
  if (!/^\S+@\S+\.\S+$/.test(email) || !name || !['admin', 'manager', 'viewer'].includes(role)) go('/admin/team', 'fehler', 'Bitte Name, gültige E-Mail und Rolle angeben.');
  await upsertAdmin(email, name, role, fd.get('notify') === 'on');
  revalidatePath('/admin/team');
  go('/admin/team', 'ok', `${name} gespeichert.`);
}
export async function removeAdminAction(fd: FormData) {
  const me = await requireAdmin('admin');
  const id = str(fd, 'id', 40);
  if (id === me.id) go('/admin/team', 'fehler', 'Du kannst dich nicht selbst entfernen.');
  await removeAdmin(id);
  revalidatePath('/admin/team');
  go('/admin/team', 'ok', 'Person entfernt.');
}

export async function logoutAction() {
  (await cookies()).delete(sessionCookie.name);
  redirect('/admin/anmelden');
}
