'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, sessionCookie } from '@/lib/auth';
import {
  Admin, addBlackout, decide, deleteBlackout, getCategories, removeAdmin, saveSettings, updateInternal, upsertAdmin,
} from '@/lib/data';
import { afterDecision } from '@/lib/notify';
import { berlinToUtc } from '@/lib/time';

const back = (fd: FormData, fallback = '/admin') => {
  const b = String(fd.get('back') ?? fallback);
  return b.startsWith('/admin') ? b : fallback;
};
const withMsg = (url: string, key: string, val: string) => url + (url.includes('?') ? '&' : '?') + key + '=' + encodeURIComponent(val);

export async function decideAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const id = String(fd.get('id'));
  const action = String(fd.get('action')) as 'confirm' | 'reject' | 'cancel';
  const reason = String(fd.get('reason') ?? '').trim();
  if ((action === 'reject' || action === 'cancel') && reason.length < 3) redirect(withMsg(`/admin/buchung/${id}`, 'fehler', 'Bitte gib eine kurze Begründung an. Sie geht per Mail an den Bucher.'));
  const b = await decide(id, action, admin.name, reason || undefined);
  if (!b) redirect(withMsg(back(fd), 'fehler', 'Die Buchung wurde inzwischen schon bearbeitet.'));
  await afterDecision(b);
  revalidatePath('/admin', 'layout');
  redirect(withMsg(back(fd), 'ok', { confirm: `„${b.title}“ ist bestätigt. ${b.name} bekommt eine Mail.`, reject: `„${b.title}“ wurde abgelehnt. ${b.name} bekommt eine Mail.`, cancel: `„${b.title}“ wurde storniert. ${b.name} bekommt eine Mail.` }[action]));
}

export async function internalAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const id = String(fd.get('id'));
  await updateInternal(id, admin.name, { internalNote: String(fd.get('internalNote') ?? '').slice(0, 2000), keyHandedOut: fd.get('keyHandedOut') === 'on', depositPaid: fd.get('depositPaid') === 'on' });
  revalidatePath(`/admin/buchung/${id}`);
  redirect(withMsg(`/admin/buchung/${id}`, 'ok', 'Gespeichert.'));
}

export async function settingsAction(fd: FormData) {
  const admin = await requireAdmin('admin');
  const num = (k: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(fd.get(k)) || 0)));
  const latest = String(fd.get('partyLatestEnd') ?? '01:00');
  const cats = (await getCategories()).map((c) => ({
    id: c.id, before: num(`before_${c.id}`, 0, 600), after: num(`after_${c.id}`, 0, 720), approval: fd.get(`approval_${c.id}`) === 'on',
  }));
  await saveSettings(admin.name, {
    partyBlocksWholeWeekend: fd.get('partyBlocksWholeWeekend') === 'on',
    partyMinLeadDays: num('partyMinLeadDays', 0, 120), minLeadHours: num('minLeadHours', 0, 336),
    horizonDays: num('horizonDays', 14, 730), capacity: num('capacity', 1, 500),
    partyLatestEnd: /^\d\d:\d\d$/.test(latest) ? latest : '01:00',
  }, cats);
  revalidatePath('/', 'layout');
  redirect('/admin/einstellungen?ok=' + encodeURIComponent('Einstellungen gespeichert.'));
}

export async function addBlackoutAction(fd: FormData) {
  const admin = await requireAdmin('manager');
  const from = String(fd.get('from')), to = String(fd.get('to')), reason = String(fd.get('reason') ?? '').trim();
  if (!/^\d{4}-\d\d-\d\d$/.test(from) || !/^\d{4}-\d\d-\d\d$/.test(to) || to < from || !reason) {
    redirect('/admin/einstellungen?fehler=' + encodeURIComponent('Bitte Zeitraum (von ≤ bis) und Grund angeben.'));
  }
  const end = berlinToUtc(to, '23:59') + 60_000;
  await addBlackout(admin.name, berlinToUtc(from, '00:00'), end, reason);
  revalidatePath('/', 'layout');
  redirect('/admin/einstellungen?ok=' + encodeURIComponent('Sperrzeit eingetragen.'));
}
export async function deleteBlackoutAction(fd: FormData) {
  await requireAdmin('manager');
  await deleteBlackout(String(fd.get('id')));
  revalidatePath('/', 'layout');
  redirect('/admin/einstellungen?ok=' + encodeURIComponent('Sperrzeit gelöscht.'));
}

export async function upsertAdminAction(fd: FormData) {
  await requireAdmin('admin');
  const email = String(fd.get('email') ?? '').trim(), name = String(fd.get('name') ?? '').trim();
  const role = String(fd.get('role')) as Admin['role'];
  if (!/^\S+@\S+\.\S+$/.test(email) || !name || !['admin', 'manager', 'viewer'].includes(role)) {
    redirect('/admin/team?fehler=' + encodeURIComponent('Bitte Name, gültige E-Mail und Rolle angeben.'));
  }
  await upsertAdmin(email, name, role, fd.get('notify') === 'on');
  revalidatePath('/admin/team');
  redirect('/admin/team?ok=' + encodeURIComponent(`${name} gespeichert.`));
}
export async function removeAdminAction(fd: FormData) {
  const me = await requireAdmin('admin');
  const id = String(fd.get('id'));
  if (id === me.id) redirect('/admin/team?fehler=' + encodeURIComponent('Du kannst dich nicht selbst entfernen.'));
  await removeAdmin(id);
  revalidatePath('/admin/team');
  redirect('/admin/team?ok=' + encodeURIComponent('Entfernt.'));
}

export async function logoutAction() {
  (await cookies()).delete(sessionCookie.name);
  redirect('/admin/anmelden');
}
