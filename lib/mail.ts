import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { db } from './db';
import { amountsDue, getExtras, type Booking, type MailTextKey } from './data';
import { dueDate } from './payment';
import type { Category } from './rules';
import { bookingIcs } from './ics';
import { eur } from './labels';
import { berlinHm, berlinYmd, fmtDay, fmtLong } from './time';
import { appUrl } from './url';

export { appUrl };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type Attachment = { filename: string; content: string }; // base64
type Mail = { to: string | string[]; subject: string; html: string; text: string; kind: string; bookingId?: string; attachments?: Attachment[]; replyTo?: string };

/**
 * Versandweg, je nach Umgebungsvariablen:
 *  - RESEND_API_KEY gesetzt → Resend (braucht eine eigene, bestätigte Domain)
 *  - SMTP_HOST/SMTP_USER/SMTP_PASS gesetzt → normales Postfach (Gmail, GMX, web.de, …), keine eigene Domain nötig
 *  - sonst → Mails werden nur in der Server-Konsole ausgegeben (Entwicklung)
 */
export type MailMode = 'resend' | 'smtp' | 'console';
export function mailMode(): MailMode {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return 'smtp';
  return 'console';
}
export function mailFrom(): string {
  if (process.env.MAIL_FROM) return process.env.MAIL_FROM;
  return mailMode() === 'smtp' ? `Jugendraum SV Heepen <${process.env.SMTP_USER}>` : 'Jugendraum SV Heepen <onboarding@resend.dev>';
}

const g = globalThis as unknown as { __smtp?: Transporter };
function smtp(): Transporter {
  if (!g.__smtp) {
    const port = Number(process.env.SMTP_PORT || 587);
    g.__smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return g.__smtp;
}

export async function sendMail(m: Mail): Promise<boolean> {
  const to = (Array.isArray(m.to) ? m.to : [m.to]).filter(Boolean);
  if (!to.length) return true;
  let ok = true; let error: string | null = null;
  const mode = mailMode();
  const replyTo = m.replyTo || process.env.MAIL_REPLY_TO || undefined;
  try {
    if (mode === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: mailFrom(), to, subject: m.subject, html: m.html, text: m.text, attachments: m.attachments, reply_to: replyTo }),
      });
      if (!res.ok) { ok = false; error = `${res.status} ${await res.text()}`.slice(0, 500); }
    } else if (mode === 'smtp') {
      await smtp().sendMail({
        from: mailFrom(), to, subject: m.subject, html: m.html, text: m.text, replyTo,
        attachments: m.attachments?.map((a) => ({ filename: a.filename, content: a.content, encoding: 'base64', contentType: 'text/calendar; charset=utf-8' })),
      });
    } else {
      const links = [...m.html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]).filter((u) => u.startsWith('http'));
      console.log(`\n[mail:${m.kind}] an ${to.join(', ')}: ${m.subject}\n${links.map((l) => '   → ' + l).join('\n')}`);
    }
  } catch (e) { ok = false; error = String(e).slice(0, 500); }
  try {
    for (const r of to) await db()`insert into mail_log (kind, recipient, subject, booking_id, ok, error) values (${m.kind}, ${r}, ${m.subject}, ${m.bookingId ?? null}, ${ok}, ${error})`;
  } catch { /* Protokoll darf den Versand nicht verhindern */ }
  if (!ok) console.error('Mailversand fehlgeschlagen:', error);
  return ok;
}

// ---------- Layout ----------
type Block = string;
const P = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2B3050">${t}</p>`;
const SMALL = (t: string) => `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#646A85">${t}</p>`;
const paragraphs = (t: string) => t.split(/\n{2,}/).map((x) => P(esc(x).replace(/\n/g, '<br>'))).join('');

function layout(o: { preheader: string; heading: string; blocks: Block[]; cta?: { href: string; label: string } }) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(o.heading)}</title></head>
<body style="margin:0;padding:0;background:#F4F5F8;font-family:'Source Sans 3','Segoe UI',Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(o.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F8;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border:1px solid #E1E4EC;border-top:4px solid #FFD800;border-radius:8px">
<tr><td style="padding:20px 28px;border-bottom:1px solid #E1E4EC">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
  <td><img src="${appUrl()}/logo.png" width="36" height="36" alt="SV Heepen" style="display:block"></td>
  <td style="padding-left:12px;font-size:16px;line-height:1.2;color:#2E367A;font-weight:700">Jugendraum<br><span style="font-size:12px;color:#646A85;font-weight:400">SV Heepen</span></td>
  </tr></table></td></tr>
<tr><td style="padding:28px 28px 8px">
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#161A33;font-weight:700">${esc(o.heading)}</h1>
${o.blocks.join('\n')}
${o.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px"><tr><td style="background:#2E367A;border-radius:8px"><a href="${o.cta.href}" style="display:inline-block;padding:12px 22px;color:#FFFFFF;font-weight:600;font-size:15px;text-decoration:none">${esc(o.cta.label)}</a></td></tr></table>` : ''}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E1E4EC;font-size:12px;line-height:1.5;color:#646A85">Jugendraum des SV Heepen · Diese Nachricht wurde automatisch versendet. Bei Fragen antworte einfach auf diese Mail oder wende dich an Michael Grieswelle oder Sigrid Brodig.</td></tr>
</table></td></tr></table></body></html>`;
}
function toText(heading: string, blocks: Block[], cta?: { href: string; label: string }) {
  const body = blocks.join('\n').replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|tr|h1)>/g, '\n').replace(/<\/td><td[^>]*>/g, ': ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
  return `${heading}\n\n${body}${cta ? `\n\n${cta.label}: ${cta.href}` : ''}\n\n--\nJugendraum des SV Heepen`;
}
function build(o: { preheader: string; heading: string; blocks: Block[]; cta?: { href: string; label: string } }) {
  return { html: layout(o), text: toText(o.heading, o.blocks, o.cta) };
}

function details(b: Booking, c?: Category, extra: [string, string][] = []): Block {
  const rows: [string, string][] = [
    ['Buchung', b.number], ['Anlass', esc(b.title)], ['Termin', `${fmtLong(b.start)}<br>${berlinHm(b.start)}–${berlinHm(b.end)} Uhr${berlinYmd(b.end) !== berlinYmd(b.start) ? ` (bis ${fmtDay(b.end)})` : ''}`],
    ...(c ? [['Art', esc(c.name)] as [string, string]] : []), ['Personen', String(b.guests)],
    ...(b.equipment.length ? [['Ausstattung', esc(b.equipment.join(', '))] as [string, string]] : []),
    ...(b.rent > 0 ? [['Nutzungsentgelt', eur(b.rent)] as [string, string]] : []), ...(b.deposit > 0 ? [['Kaution', eur(b.deposit)] as [string, string]] : []),
    ...extra,
  ];
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 20px;background:#F8F9FB;border:1px solid #E1E4EC;border-radius:8px">
${rows.map(([k, v], i) => `<tr><td style="padding:9px 14px;font-size:13px;color:#646A85;vertical-align:top;width:120px;${i ? 'border-top:1px solid #E1E4EC' : ''}">${k}</td><td style="padding:9px 14px;font-size:14px;color:#161A33;font-weight:600;${i ? 'border-top:1px solid #E1E4EC' : ''}">${v}</td></tr>`).join('')}
</table>`;
}
/** Bezahlteil für Mails: offener Betrag, Frist und Link zur Bezahlseite. */
async function payBlock(b: Booking): Promise<Block[]> {
  const due = amountsDue(b);
  if (b.status !== 'confirmed' || due.total <= 0) return [];
  const pay = (await getExtras()).payment;
  const until = dueDate(b.start, pay.dueDays);
  const lines = [due.rent > 0 ? `Nutzungsentgelt ${eur(due.rent)}` : '', due.deposit > 0 ? `Kaution ${eur(due.deposit)}` : ''].filter(Boolean).join(' + ');
  return [P(`<b>Bitte bezahlen:</b> ${lines}${due.rent > 0 && due.deposit > 0 ? ` = <b>${eur(due.total)}</b>` : ''}, ${until <= Date.now() ? 'bitte vor der Schlüsselübergabe' : `bis ${fmtLong(until)}`}. Auf deiner Buchungsseite findest du alle Wege: Überweisung mit QR-Code${pay.paypal && pay.paypalMe ? ', PayPal' : ''}${pay.stripe ? ' oder online' : ''}.`)];
}
const manageLink = (b: Booking) => `${appUrl()}/buchung/${b.manageToken}`;
const ics = (b: Booking, c?: Category): Attachment[] => [{ filename: `jugendraum-${b.number}.ics`, content: Buffer.from(bookingIcs(b, c)).toString('base64') }];
/** Stille Buchungen (vom Team für andere eingetragen) bekommen keine automatischen Mails. */
const bookerTo = (b: Booking) => (b.silent ? [] : [b.email]);
const firstName = (n: string) => esc(n.split(' ')[0]);

/** Standardtexte. Das Orga-Team kann sie in der Verwaltung überschreiben (Einstellungen → E-Mail-Texte). */
export const DEFAULT_TEXTS: Record<MailTextKey, string> = {
  received: 'vielen Dank für deine Anfrage. Wir prüfen sie und melden uns so schnell wie möglich bei dir.',
  confirmed: 'der Jugendraum ist für dich reserviert. Den Termin findest du als Kalenderdatei im Anhang.\n\nBitte stimm die Schlüsselübergabe rechtzeitig mit deiner Ansprechperson ab. Nach der Nutzung den Raum besenrein verlassen, Müll mitnehmen, Fenster schließen und Licht ausschalten.',
  rejected: 'leider können wir deine Anfrage für diesen Termin nicht bestätigen.',
  reminder: 'kurze Erinnerung an deine Buchung im Jugendraum. Hast du die Schlüsselübergabe schon abgestimmt?',
  followup: 'danke, dass du den Jugendraum genutzt hast. Wir freuen uns über eine kurze Rückmeldung. Falls etwas kaputtgegangen ist oder fehlt, sag uns bitte Bescheid.',
};
export const TEXT_LABELS: Record<MailTextKey, string> = {
  received: 'Anfrage eingegangen', confirmed: 'Buchung bestätigt', rejected: 'Anfrage abgelehnt', reminder: 'Erinnerung vor dem Termin', followup: 'Nachfrage nach dem Termin',
};
async function text(k: MailTextKey) {
  try { return (await getExtras()).mailTexts[k]?.trim() || DEFAULT_TEXTS[k]; } catch { return DEFAULT_TEXTS[k]; }
}
const hello = (b: Booking) => `Hallo ${firstName(b.name)},`;

// ---------- Mails an Bucher ----------
export const mails = {
  verify: (b: Booking, c: Category | undefined, verifyToken: string) => {
    const cta = { href: `${appUrl()}/bestaetigen/${verifyToken}`, label: 'Anfrage bestätigen' };
    const blocks = [P(hello(b)), P('bitte bestätige kurz deine E-Mail-Adresse. Erst dann geht deine Anfrage an das Orga-Team.'), details(b, c)];
    return sendMail({ kind: 'verify', to: bookerTo(b), bookingId: b.id, subject: `Bitte bestätige deine Anfrage ${b.number}`,
      ...build({ preheader: 'Ein Klick, dann geht deine Anfrage an das Orga-Team.', heading: 'Bitte bestätige deine Anfrage', blocks: [...blocks, SMALL('Ohne Bestätigung verfällt die Anfrage nach 24 Stunden. Du hast nichts angefragt? Dann ignoriere diese Mail einfach.')], cta }) });
  },
  received: async (b: Booking, c?: Category) => {
    const blocks = [P(hello(b)), paragraphs(await text('received')), details(b, c)];
    return sendMail({ kind: 'received', to: bookerTo(b), bookingId: b.id, subject: `Anfrage eingegangen: ${b.title} am ${fmtDay(b.start)}`,
      ...build({ preheader: 'Wir prüfen deine Anfrage.', heading: 'Deine Anfrage ist eingegangen', blocks, cta: { href: manageLink(b), label: 'Anfrage ansehen' } }) });
  },
  confirmed: async (b: Booking, c?: Category) => {
    const blocks = [P(hello(b)), paragraphs(await text('confirmed')), details(b, c, [['Ansprechperson', esc(b.agreedWith)]]), ...(await payBlock(b))];
    return sendMail({ kind: 'confirmed', to: bookerTo(b), bookingId: b.id, subject: `Bestätigt: ${b.title} am ${fmtDay(b.start)}`, attachments: ics(b, c),
      ...build({ preheader: `Der Jugendraum ist für dich reserviert: ${fmtLong(b.start)}.`, heading: 'Deine Buchung ist bestätigt', blocks, cta: { href: manageLink(b), label: 'Buchung ansehen' } }) });
  },
  changed: async (b: Booking, before: Booking, c?: Category, note?: string) => {
    const blocks = [P(hello(b)), P(`das Orga-Team hat deine Buchung geändert. Bisher: ${fmtLong(before.start)}, ${berlinHm(before.start)}–${berlinHm(before.end)} Uhr.`),
      ...(note ? [P(`<b>Hinweis:</b> ${esc(note)}`)] : []), details(b, c), SMALL('Passt der neue Termin nicht? Melde dich bitte bei deiner Ansprechperson oder sag über den Link ab.')];
    return sendMail({ kind: 'changed', to: bookerTo(b), bookingId: b.id, subject: `Geändert: ${b.title} jetzt am ${fmtDay(b.start)}`, attachments: b.status === 'confirmed' ? ics(b, c) : undefined,
      ...build({ preheader: `Neuer Termin: ${fmtLong(b.start)}, ${berlinHm(b.start)} Uhr.`, heading: 'Deine Buchung wurde geändert', blocks, cta: { href: manageLink(b), label: 'Buchung ansehen' } }) });
  },
  rejected: async (b: Booking, c?: Category) => {
    const blocks = [P(hello(b)), paragraphs(await text('rejected')), ...(b.rejectReason ? [P(`<b>Begründung:</b> ${esc(b.rejectReason)}`)] : []), details(b, c), P('Vielleicht passt ein anderer Termin.')];
    return sendMail({ kind: 'rejected', to: bookerTo(b), bookingId: b.id, subject: `Absage: ${b.title} am ${fmtDay(b.start)}`,
      ...build({ preheader: 'Leider können wir deine Anfrage nicht bestätigen.', heading: 'Deine Anfrage wurde abgelehnt', blocks, cta: { href: appUrl(), label: 'Freie Termine ansehen' } }) });
  },
  cancelled: (b: Booking, c?: Category) => {
    const blocks = [P(hello(b)), P('deine Buchung wurde storniert. Der Termin ist wieder frei.'), ...(b.rejectReason ? [P(`<b>Grund:</b> ${esc(b.rejectReason)}`)] : []), details(b, c)];
    return sendMail({ kind: 'cancelled', to: bookerTo(b), bookingId: b.id, subject: `Storniert: ${b.title} am ${fmtDay(b.start)}`,
      ...build({ preheader: 'Deine Buchung wurde storniert.', heading: 'Buchung storniert', blocks }) });
  },
  reminder: async (b: Booking, c: Category | undefined, when: '3d' | '1d') => {
    const blocks = [P(hello(b)), paragraphs(await text('reminder')), details(b, c, [['Ansprechperson', esc(b.agreedWith)]]), ...(await payBlock(b))];
    const label = when === '1d' ? 'Morgen' : 'In drei Tagen';
    return sendMail({ kind: `reminder-${when}`, to: bookerTo(b), bookingId: b.id, subject: `${label}: ${b.title} im Jugendraum`,
      ...build({ preheader: `${label}, ${berlinHm(b.start)} Uhr.`, heading: `${label} ist es so weit`, blocks, cta: { href: manageLink(b), label: 'Buchung ansehen' } }) });
  },
  paid: (b: Booking, amount: number) => sendMail({ kind: 'paid', to: bookerTo(b), bookingId: b.id, subject: `Zahlung erhalten: ${eur(amount)} für ${b.number}`,
    ...build({ preheader: 'Danke, deine Zahlung ist eingegangen.', heading: 'Zahlung erhalten', blocks: [P(hello(b)), P(`wir haben deine Zahlung über <b>${eur(amount)}</b> für „${esc(b.title)}“ am ${fmtLong(b.start)} erhalten. Danke!`),
      ...(b.depositPaid && b.deposit > 0 ? [SMALL('Die Kaution bekommst du nach der Abnahme des Raums zurück.')] : [])], cta: { href: manageLink(b), label: 'Buchung ansehen' } }) }),
  depositRefunded: (b: Booking, amount: number) => sendMail({ kind: 'refund', to: bookerTo(b), bookingId: b.id, subject: `Kaution erstattet: ${eur(amount)} für ${b.number}`,
    ...build({ preheader: 'Die Kaution ist auf dem Weg zurück zu dir.', heading: 'Kaution erstattet', blocks: [P(hello(b)), P(`wir haben dir <b>${eur(amount)}</b> Kaution für „${esc(b.title)}“ erstattet. Je nach Zahlungsart dauert es ein paar Tage, bis der Betrag bei dir ankommt.`)] }) }),
  followup: async (b: Booking) => {
    const blocks = [P(hello(b)), paragraphs(await text('followup'))];
    return sendMail({ kind: 'followup', to: bookerTo(b), bookingId: b.id, subject: `Wie war es? ${b.title}`,
      ...build({ preheader: 'Eine Minute für deine Rückmeldung.', heading: 'Danke fürs Vorbeikommen', blocks, cta: { href: `${manageLink(b)}/feedback`, label: 'Rückmeldung geben' } }) });
  },
};

const waitLink = (w: { categoryId: string; start: number; end: number }) =>
  `${appUrl()}/?datum=${berlinYmd(w.start)}&von=${berlinHm(w.start)}&bis=${berlinHm(w.end)}&art=${w.categoryId}`;
export const bookerMails = {
  waitlistJoined: (w: { name: string; email: string; token: string; start: number; end: number }) => sendMail({ kind: 'waitlist-joined', to: w.email,
    subject: `Warteliste: ${fmtDay(w.start)}, ${berlinHm(w.start)}–${berlinHm(w.end)} Uhr`,
    ...build({ preheader: 'Wir melden uns, sobald der Termin frei wird.', heading: 'Du stehst auf der Warteliste', blocks: [
      P(`Hallo ${firstName(w.name)},`), P(`wir schreiben dir, sobald der Jugendraum am <b>${fmtLong(w.start)}, ${berlinHm(w.start)}–${berlinHm(w.end)} Uhr</b> frei wird. Dann kannst du ihn ganz normal anfragen.`),
      SMALL('Ein freier Termin ist nicht reserviert: Wer zuerst anfragt, bekommt ihn.'),
      SMALL(`Kein Interesse mehr? <a href="${appUrl()}/warteliste/${w.token}" style="color:#2E367A">Von der Warteliste abmelden</a>.`)] }) }),
  waitlistFree: (w: { name: string; email: string; categoryId: string; start: number; end: number }) => sendMail({ kind: 'waitlist-free', to: w.email,
    subject: `Jetzt frei: Jugendraum am ${fmtDay(w.start)}`,
    ...build({ preheader: 'Der Termin, auf den du gewartet hast, ist wieder frei.', heading: 'Dein Wunschtermin ist frei geworden', blocks: [
      P(`Hallo ${firstName(w.name)},`), P(`der Jugendraum ist am <b>${fmtLong(w.start)}, ${berlinHm(w.start)}–${berlinHm(w.end)} Uhr</b> wieder frei. Wenn du ihn noch brauchst, frag ihn jetzt an. Datum und Uhrzeit sind schon eingetragen.`),
      SMALL('Der Termin ist nicht für dich reserviert. Andere auf der Warteliste wurden ebenfalls informiert.')], cta: { href: waitLink(w), label: 'Jetzt anfragen' } }) }),

  myBookings: (to: string, link: string) => sendMail({ kind: 'my-bookings', to, subject: 'Deine Buchungen im Jugendraum',
    ...build({ preheader: 'Link zu deiner Übersicht, 7 Tage gültig.', heading: 'Deine Buchungen', blocks: [P('Hier ist der Link zu all deinen Buchungen im Jugendraum. Dort kannst du sie ansehen, in den Kalender übernehmen oder absagen.'), SMALL('Der Link ist 7 Tage gültig. Du hast ihn nicht angefordert? Dann ignoriere diese Mail.')], cta: { href: link, label: 'Meine Buchungen ansehen' } }) }),
};

// ---------- Mails ans Orga-Team ----------
const adminLink = (b: Booking) => `${appUrl()}/admin/buchung/${b.id}`;
const who = (b: Booking) => `${esc(b.name)} (${b.bookerType === 'member' ? 'Mitglied' + (b.team ? ', ' + esc(b.team) : '') : 'nicht im Verein'}) · ${esc(b.email)} · ${esc(b.phone)}`;
export const teamMails = {
  newRequest: (to: string[], b: Booking, c?: Category, conflicts?: string) => {
    const blocks = [P(who(b)), details(b, c, [['Abgesprochen mit', esc(b.agreedWith)]]), ...(b.note ? [P(`„${esc(b.note)}“`)] : []),
      ...(conflicts ? [P(`<span style="color:#B42F36"><b>Achtung:</b> ${esc(conflicts)}</span>`)] : [])];
    return sendMail({ kind: 'team-new', to, bookingId: b.id, replyTo: b.email, subject: `Neue Anfrage: ${b.title}, ${fmtDay(b.start)}`,
      ...build({ preheader: `${b.name} fragt ${fmtLong(b.start)} an.`, heading: 'Neue Anfrage', blocks, cta: { href: adminLink(b), label: 'Prüfen und entscheiden' } }) });
  },
  autoConfirmed: (to: string[], b: Booking, c?: Category) => sendMail({ kind: 'team-info', to, bookingId: b.id, subject: `Eingetragen: ${b.title}, ${fmtDay(b.start)}`,
    ...build({ preheader: 'Automatisch bestätigt.', heading: 'Neuer Termin (automatisch bestätigt)', blocks: [P(who(b)), details(b, c)], cta: { href: adminLink(b), label: 'Ansehen' } }) }),
  cancelled: (to: string[], b: Booking, c?: Category) => sendMail({ kind: 'team-cancelled', to, bookingId: b.id, subject: `Abgesagt: ${b.title}, ${fmtDay(b.start)}`,
    ...build({ preheader: 'Der Termin ist wieder frei.', heading: 'Buchung abgesagt', blocks: [P(`${esc(b.name)} hat abgesagt. Der Termin ist wieder frei.`), details(b, c)], cta: { href: adminLink(b), label: 'Ansehen' } }) }),
  damage: (to: string[], b: Booking, comment: string) => sendMail({ kind: 'team-damage', to, bookingId: b.id, replyTo: b.email, subject: `Schaden gemeldet: ${b.title} (${b.number})`,
    ...build({ preheader: 'Bei der Rückmeldung wurde ein Schaden gemeldet.', heading: 'Schaden gemeldet', blocks: [P(who(b)), P(comment ? `„${esc(comment)}“` : 'Ohne Beschreibung.'), details(b)], cta: { href: adminLink(b), label: 'Zur Buchung' } }) }),
  test: (to: string) => sendMail({ kind: 'test', to, subject: 'Testmail: Jugendraum-Portal',
    ...build({ preheader: 'Der Mailversand funktioniert.', heading: 'Der Mailversand funktioniert', blocks: [P('Diese Mail kommt aus dem Jugendraum-Portal. Wenn du sie liest, ist alles richtig eingerichtet.'), SMALL(`Versandweg: ${mailMode() === 'smtp' ? 'eigenes Postfach (SMTP)' : mailMode() === 'resend' ? 'Resend' : 'Konsole'} · Absender: ${esc(mailFrom())}`)] }) }),
  login: (to: string, link: string) => sendMail({ kind: 'login', to, subject: 'Dein Anmeldelink für die Jugendraum-Verwaltung',
    ...build({ preheader: 'Gültig für 15 Minuten.', heading: 'Anmelden', blocks: [P('Mit dem Button meldest du dich in der Verwaltung an. Der Link ist 15 Minuten gültig und funktioniert einmal.'), SMALL('Du hast keine Anmeldung angefordert? Dann ignoriere diese Mail.')], cta: { href: link, label: 'Jetzt anmelden' } }) }),
  digest: (to: string[], items: { b: Booking; c?: Category }[], open: number) => {
    const rows = items.length ? items.map(({ b, c }) => P(`<b>${fmtLong(b.start)}</b>, ${berlinHm(b.start)}–${berlinHm(b.end)} Uhr<br>${esc(b.title)} · ${esc(c?.name ?? '')} · ${esc(b.name)}`)).join('') : P('Diese Woche sind keine Termine eingetragen.');
    return sendMail({ kind: 'digest', to, subject: `Jugendraum diese Woche: ${items.length} Termine${open ? `, ${open} offene Anfragen` : ''}`,
      ...build({ preheader: `${items.length} Termine, ${open} offene Anfragen.`, heading: 'Die Woche im Jugendraum', blocks: [rows, ...(open ? [P(`<b>${open} Anfrage(n)</b> warten auf eine Entscheidung.`)] : [])], cta: { href: `${appUrl()}/admin`, label: 'Zur Verwaltung' } }) });
  },
};
