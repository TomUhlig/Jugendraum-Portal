import 'server-only';
import { db } from './db';
import type { Booking } from './data';
import type { Category } from './rules';
import { fmtLong, berlinHm } from './time';
import { bookingIcs } from './ics';

export { appUrl } from './url';
import { appUrl } from './url';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type Attachment = { filename: string; content: string }; // content: base64
type Mail = { to: string | string[]; subject: string; html: string; kind: string; bookingId?: string; attachments?: Attachment[] };

/** Versand über Resend. Ohne RESEND_API_KEY wird die Mail nur in der Konsole ausgegeben (Entwicklung). */
export async function sendMail(m: Mail): Promise<boolean> {
  const to = Array.isArray(m.to) ? m.to : [m.to];
  if (!to.length) return true;
  let ok = true; let error: string | null = null;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.MAIL_FROM ?? 'Jugendraum SV Heepen <jugendraum@sv-heepen.de>',
          to, subject: m.subject, html: m.html, attachments: m.attachments,
        }),
      });
      if (!res.ok) { ok = false; error = `${res.status} ${await res.text()}`.slice(0, 500); }
    } catch (e) { ok = false; error = String(e).slice(0, 500); }
  } else {
    const links = [...m.html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]).filter((u) => u.startsWith('http'));
    console.log(`\n✉️  [${m.kind}] an ${to.join(', ')}: ${m.subject}\n${links.map((l) => '   → ' + l).join('\n')}`);
  }
  try {
    for (const r of to) await db()`insert into mail_log (kind, recipient, subject, booking_id, ok, error) values (${m.kind}, ${r}, ${m.subject}, ${m.bookingId ?? null}, ${ok}, ${error})`;
  } catch { /* Protokoll darf den Versand nicht verhindern */ }
  if (!ok) console.error('Mailversand fehlgeschlagen:', error);
  return ok;
}

// ---------- Layout im Vereinsdesign ----------
function layout(title: string, body: string, cta?: { href: string; label: string }) {
  return `<!doctype html><html lang="de"><body style="margin:0;background:#F5F6FB;font-family:'Source Sans 3',Segoe UI,Arial,sans-serif;color:#151A3D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6FB;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #D9DCEC">
<tr><td style="background:#2E367A;padding:18px 24px"><img src="${appUrl()}/logo.png" width="40" height="40" alt="SV Heepen" style="vertical-align:middle">
<span style="font-family:Archivo,Arial Black,Arial,sans-serif;font-weight:900;color:#FFD800;font-size:20px;letter-spacing:2px;vertical-align:middle;margin-left:10px">JUGENDRAUM</span></td></tr>
<tr><td style="padding:24px">
<h1 style="font-family:Archivo,Arial Black,Arial,sans-serif;font-size:22px;margin:0 0 14px;color:#2E367A">${title}</h1>
${body}
${cta ? `<p style="margin:22px 0 4px"><a href="${cta.href}" style="display:inline-block;background:#FFD800;color:#1E2458;font-weight:800;text-decoration:none;padding:12px 22px;font-family:Archivo,Arial,sans-serif;text-transform:uppercase;letter-spacing:1px">${cta.label}</a></p>` : ''}
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #D9DCEC;font-size:12px;color:#5A6085">SV Heepen · Jugendraum am Sportplatz · Diese Mail wurde automatisch verschickt.</td></tr>
</table></td></tr></table></body></html>`;
}
const p = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${t}</p>`;
function details(b: Booking, c?: Category) {
  const row = (k: string, v: string) => `<tr><td style="padding:4px 14px 4px 0;color:#5A6085;font-size:14px;vertical-align:top">${k}</td><td style="padding:4px 0;font-size:14px;font-weight:600">${v}</td></tr>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;border-left:4px solid #FFD800;padding-left:12px">
${row('Nr.', b.number)}${row('Anlass', esc(b.title))}${row('Wann', `${fmtLong(b.start)}<br>${berlinHm(b.start)}–${berlinHm(b.end)} Uhr`)}
${c ? row('Kategorie', c.name) : ''}${row('Personen', String(b.guests))}${row('Abgesprochen mit', esc(b.agreedWith))}</table>`;
}
const manageLink = (b: Booking) => `${appUrl()}/buchung/${b.manageToken}`;
const ics = (b: Booking, c?: Category): Attachment[] => [{ filename: `jugendraum-${b.number}.ics`, content: Buffer.from(bookingIcs(b, c)).toString('base64') }];

// ---------- Mails an Bucher ----------
export const mails = {
  verify: (b: Booking, c: Category | undefined, verifyToken: string) => sendMail({
    kind: 'verify', to: b.email, bookingId: b.id, subject: `Bitte bestätige deine Anfrage (${b.number})`,
    html: layout('Fast geschafft!', p(`Hallo ${esc(b.name)}, bitte bestätige kurz deine E-Mail-Adresse. Erst dann landet deine Anfrage beim Orga-Team.`) + details(b, c)
      + p('<small style="color:#5A6085">Ohne Bestätigung verfällt die Anfrage nach 24 Stunden.</small>'),
      { href: `${appUrl()}/bestaetigen/${verifyToken}`, label: 'Anfrage bestätigen' }),
  }),
  received: (b: Booking, c?: Category) => sendMail({
    kind: 'received', to: b.email, bookingId: b.id, subject: `Anfrage eingegangen: ${b.title} (${b.number})`,
    html: layout('Deine Anfrage ist da', p('Danke! Das Orga-Team prüft deine Anfrage und meldet sich per Mail.') + details(b, c), { href: manageLink(b), label: 'Anfrage ansehen' }),
  }),
  confirmed: (b: Booking, c?: Category) => sendMail({
    kind: 'confirmed', to: b.email, bookingId: b.id, subject: `Bestätigt: ${b.title} am ${fmtLong(b.start)}`, attachments: ics(b, c),
    html: layout('Deine Buchung ist bestätigt', p(`Hallo ${esc(b.name)}, der Jugendraum ist für dich reserviert. Den Termin findest du als Kalenderdatei im Anhang.`) + details(b, c)
      + p('<b>Vorher:</b> Schlüsselübergabe mit deiner Ansprechperson abstimmen.<br><b>Nachher:</b> Raum besenrein verlassen, Müll mitnehmen, Fenster zu, Licht aus.'),
      { href: manageLink(b), label: 'Buchung ansehen' }),
  }),
  rejected: (b: Booking, c?: Category) => sendMail({
    kind: 'rejected', to: b.email, bookingId: b.id, subject: `Leider abgelehnt: ${b.title} (${b.number})`,
    html: layout('Das klappt leider nicht', p(`Hallo ${esc(b.name)}, deine Anfrage konnten wir leider nicht bestätigen.`) + details(b, c)
      + (b.rejectReason ? p(`<b>Begründung:</b> ${esc(b.rejectReason)}`) : '') + p('Schau gern nach einem anderen Termin.'),
      { href: appUrl(), label: 'Freie Termine ansehen' }),
  }),
  cancelled: (b: Booking, c?: Category) => sendMail({
    kind: 'cancelled', to: b.email, bookingId: b.id, subject: `Storniert: ${b.title} (${b.number})`,
    html: layout('Buchung storniert', p('Deine Buchung wurde storniert. Der Termin ist wieder frei.') + details(b, c)),
  }),
  reminder: (b: Booking, c: Category | undefined, when: '3d' | '1d') => sendMail({
    kind: `reminder-${when}`, to: b.email, bookingId: b.id, subject: `${when === '1d' ? 'Morgen' : 'In 3 Tagen'}: ${b.title} im Jugendraum`,
    html: layout(when === '1d' ? 'Morgen geht’s los' : 'Bald ist es so weit', p('Kurze Erinnerung an deine Buchung:') + details(b, c)
      + p('Hast du den Schlüssel organisiert? Bei Fragen melde dich bei deiner Ansprechperson.'), { href: manageLink(b), label: 'Buchung ansehen' }),
  }),
  followup: (b: Booking) => sendMail({
    kind: 'followup', to: b.email, bookingId: b.id, subject: `Alles gut gelaufen? (${b.number})`,
    html: layout('Danke fürs Vorbeikommen!', p(`Hallo ${esc(b.name)}, wir hoffen, „${esc(b.title)}“ war ein voller Erfolg. Ist etwas kaputtgegangen oder fehlt etwas? Antworte einfach auf diese Mail.`)),
  }),
};

// ---------- Mails ans Orga-Team ----------
export const teamMails = {
  newRequest: (to: string[], b: Booking, c?: Category, conflicts?: string) => sendMail({
    kind: 'team-new', to, bookingId: b.id, subject: `Neue Anfrage: ${b.title} · ${fmtLong(b.start)}`,
    html: layout('Neue Anfrage', p(`<b>${esc(b.name)}</b> (${b.bookerType === 'member' ? 'Mitglied' + (b.team ? ', ' + esc(b.team) : '') : 'Extern'}) · ${esc(b.email)} · ${esc(b.phone)}`)
      + details(b, c) + (b.note ? p(`<i>„${esc(b.note)}“</i>`) : '') + (conflicts ? p(`<span style="color:#C2323A"><b>Achtung:</b> ${esc(conflicts)}</span>`) : ''),
      { href: `${appUrl()}/admin/buchung/${b.id}`, label: 'Prüfen und entscheiden' }),
  }),
  autoConfirmed: (to: string[], b: Booking, c?: Category) => sendMail({
    kind: 'team-info', to, bookingId: b.id, subject: `Neu eingetragen: ${b.title} · ${fmtLong(b.start)}`,
    html: layout('Neuer Termin (automatisch bestätigt)', details(b, c) + p(`${esc(b.name)} · ${esc(b.team)}`), { href: `${appUrl()}/admin/buchung/${b.id}`, label: 'Ansehen' }),
  }),
  cancelled: (to: string[], b: Booking, c?: Category) => sendMail({
    kind: 'team-cancelled', to, bookingId: b.id, subject: `Storniert: ${b.title} · ${fmtLong(b.start)}`,
    html: layout('Buchung storniert', p(`${esc(b.name)} hat storniert. Der Termin ist wieder frei.`) + details(b, c)),
  }),
  login: (to: string, link: string) => sendMail({
    kind: 'login', to, subject: 'Dein Login-Link für die Jugendraum-Verwaltung',
    html: layout('Anmelden', p('Klick auf den Button, um dich anzumelden. Der Link ist 15 Minuten gültig und funktioniert einmal.'), { href: link, label: 'Jetzt anmelden' }),
  }),
  digest: (to: string[], items: { b: Booking; c?: Category }[], open: number) => sendMail({
    kind: 'digest', to, subject: `Jugendraum diese Woche: ${items.length} Termine${open ? `, ${open} offene Anfragen` : ''}`,
    html: layout('Die Woche im Jugendraum', (items.length ? items.map(({ b, c }) => p(`<b>${fmtLong(b.start)}</b>, ${berlinHm(b.start)}–${berlinHm(b.end)}<br>${esc(b.title)} · ${c?.name ?? ''} · ${esc(b.name)}`)).join('') : p('Keine Termine diese Woche.'))
      + (open ? p(`<b>${open} Anfrage(n)</b> warten auf eine Entscheidung.`) : ''), { href: `${appUrl()}/admin`, label: 'Zur Verwaltung' }),
  }),
};
