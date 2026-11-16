import 'server-only';
import { googleCalendarLink } from './gcal-link';
import { inboxEnabled, plusAddress } from './inbox-parse';
import { decisionToken } from './auth';
import nodemailer, { type Transporter } from 'nodemailer';
import { db } from './db';
import { hausordnungPdf, protocolPdf } from './pdf';
import { amountsDue, getCategories, getExtras, getSettings, getSignatures, type Booking, type MailTextKey } from './data';
import { dueDate } from './payment';
import type { Category } from './rules';
import { bookingIcs } from './ics';
import { eur } from './labels';
import { LOCALE, catLabel, type Lang } from './i18n';
import { MAIL_TEXT } from './mail-i18n';
import { berlinHm, berlinYmd, fmtDay, fmtLong } from './time';
import { appUrl } from './url';

export { appUrl };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type Attachment = { filename: string; content: string }; // base64
type Mail = { to: string | string[]; subject: string; html: string; text: string; kind: string; bookingId?: string; attachments?: Attachment[]; replyTo?: string; number?: string };

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
  // Antworten mit Buchungsnummer in der Adresse, damit sie im Nachrichtenverlauf landen (nur mit Postfach-Abruf)
  const plus = !m.replyTo && m.number && mode === 'smtp' && inboxEnabled() ? plusAddress(process.env.SMTP_USER ?? '', m.number) : null;
  const replyTo = m.replyTo || plus || process.env.MAIL_REPLY_TO || undefined;
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
        attachments: m.attachments?.map((a) => ({ filename: a.filename, content: a.content, encoding: 'base64', contentType: a.filename.endsWith('.pdf') ? 'application/pdf' : 'text/calendar; charset=utf-8' })),
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
const eurL = (n: number, lang: Lang) => n.toLocaleString(LOCALE[lang], { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 });

type Mailout = { preheader: string; heading: string; blocks: Block[]; cta?: { href: string; label: string }; lang?: Lang; after?: Block[]; progress?: 1 | 2 | 3 | 4 };
function layout(o: Mailout) {
  const M = MAIL_TEXT[o.lang ?? 'de'];
  return `<!doctype html><html lang="${o.lang ?? 'de'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(o.heading)}</title></head>
<body style="margin:0;padding:0;background:#F4F5F8;font-family:'Source Sans 3','Segoe UI',Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(o.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F8;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border:1px solid #E1E4EC;border-top:4px solid #FFD800;border-radius:8px">
<tr><td style="padding:20px 28px;border-bottom:1px solid #E1E4EC">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
  <td><img src="${appUrl()}/logo.png" width="36" height="36" alt="SV Heepen" style="display:block"></td>
  <td style="padding-left:12px;font-size:16px;line-height:1.2;color:#2E367A;font-weight:700">${M.room}<br><span style="font-size:12px;color:#646A85;font-weight:400">SV Heepen</span></td>
  </tr></table></td></tr>
<tr><td style="padding:28px 28px 8px">
${o.progress ? progressBar(o.progress, o.lang ?? 'de') : ''}<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#161A33;font-weight:700">${esc(o.heading)}</h1>
${o.blocks.join('\n')}
${o.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px"><tr><td style="background:#2E367A;border-radius:8px"><a href="${o.cta.href}" style="display:inline-block;padding:12px 22px;color:#FFFFFF;font-weight:600;font-size:15px;text-decoration:none">${esc(o.cta.label)}</a></td></tr></table>` : ''}
${(o.after ?? []).join('\n')}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E1E4EC;font-size:12px;line-height:1.5;color:#646A85">${M.footer}</td></tr>
</table></td></tr></table></body></html>`;
}
const PROGRESS: Record<Lang, string[]> = {
  de: ['Angefragt', 'E-Mail bestätigt', 'Bestätigt', 'Termin'],
  en: ['Requested', 'Email confirmed', 'Confirmed', 'Your date'],
  tr: ['Talep', 'E-posta onaylandı', 'Onaylandı', 'Tarih'],
};
/** Kleine Schrittanzeige oben in Bucher-Mails: wo steht meine Anfrage? */
function progressBar(step: number, lang: Lang): string {
  const cells = PROGRESS[lang].map((l, i) => {
    const done = i < step, cur = i === step - 1;
    const dot = `<span style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:9px;text-align:center;font-size:11px;font-weight:700;${done ? 'background:#2E367A;color:#FFFFFF' : 'background:#FFFFFF;color:#8A8FA8;border:1px solid #C9CCDA;line-height:16px'}">${done && !cur ? '&#10003;' : i + 1}</span>`;
    return `<td style="padding:0 6px 0 0;white-space:nowrap;font-size:12px;color:${cur ? '#161A33' : done ? '#3D4260' : '#8A8FA8'};font-weight:${cur ? 700 : 400}">${dot}&nbsp;${esc(l)}</td>${i < 3 ? `<td width="33%" style="padding:0 8px 0 2px"><div style="height:2px;background:${i < step - 1 ? '#2E367A' : '#E1E4EC'};min-width:12px"></div></td>` : ''}`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr>${cells}</tr></table>`;
}
function toText(o: Mailout) {
  const body = [...o.blocks, ...(o.after ?? [])].join('\n').replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|tr|h1)>/g, '\n').replace(/<\/td><td[^>]*>/g, ': ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
  return `${o.heading}\n\n${body}${o.cta ? `\n\n${o.cta.label}: ${o.cta.href}` : ''}\n\n--\n${MAIL_TEXT[o.lang ?? 'de'].footerText}`;
}
function build(o: Mailout) {
  return { html: layout(o), text: toText(o) };
}


const GCAL_TX: Record<Lang, string> = { de: 'In Google Kalender eintragen', en: 'Add to Google Calendar', tr: 'Google Takvim’e ekle' };
const ATTACH_TX: Record<Lang, string> = { de: 'Kalenderdatei und Hausordnung (PDF) im Anhang', en: 'Calendar file and house rules (PDF) attached', tr: 'Takvim dosyası ve ev kuralları (PDF) ekte' };
const PROTO_TX = {
  de: { out: { subject: (t: string) => `Schlüssel übergeben: ${t}`, heading: 'Schlüssel übergeben', text: 'danke, der Schlüssel ist übergeben. Das unterschriebene Protokoll findest du im Anhang. Viel Spaß im Jugendraum!' },
        in: { subject: (t: string) => `Rückgabe bestätigt: ${t}`, heading: 'Rückgabe bestätigt', text: 'danke für die Rückgabe. Das unterschriebene Protokoll mit Zählerstand und Zustand findest du im Anhang.' } },
  en: { out: { subject: (t: string) => `Key handed over: ${t}`, heading: 'Key handed over', text: 'thank you, the key has been handed over. The signed record is attached. Enjoy the youth room!' },
        in: { subject: (t: string) => `Return confirmed: ${t}`, heading: 'Return confirmed', text: 'thank you for returning the room. The signed record with meter reading and condition is attached.' } },
  tr: { out: { subject: (t: string) => `Anahtar teslim edildi: ${t}`, heading: 'Anahtar teslim edildi', text: 'teşekkürler, anahtar teslim edildi. İmzalı tutanak ektedir. Gençlik salonunda iyi eğlenceler!' },
        in: { subject: (t: string) => `İade onaylandı: ${t}`, heading: 'İade onaylandı', text: 'iade için teşekkürler. Sayaç ve durum bilgisini içeren imzalı tutanak ektedir.' } },
};
const SERIES_TX = {
  de: { title: (n: number) => `Alle ${n} Termine der Serie`, skipped: 'Diese Termine waren schon belegt und wurden nicht angefragt:' },
  en: { title: (n: number) => `All ${n} dates of the series`, skipped: 'These dates were already taken and were not requested:' },
  tr: { title: (n: number) => `Serinin ${n} tarihinin tümü`, skipped: 'Bu tarihler zaten doluydu ve talep edilmedi:' },
};
/** Terminliste einer Serie als Mail-Block. */
function seriesBlock(dates: { start: number; end: number }[], lang: Lang, skipped: number[] = []): Block[] {
  if (dates.length < 2 && !skipped.length) return [];
  const T = SERIES_TX[lang];
  const li = (s: string) => `<li style="margin:0 0 2px">${s}</li>`;
  const out = [`<div style="margin:0 0 18px;padding:12px 16px;background:#F8F9FB;border-radius:8px"><div style="font-weight:600;margin-bottom:6px;color:#161A33">${T.title(dates.length)}</div><ul style="margin:0;padding-left:18px;color:#3D4260;font-size:14px;line-height:1.5">${dates.map((d) => li(`${fmtDay(d.start, lang)}, ${berlinHm(d.start)}–${berlinHm(d.end)}`)).join('')}</ul></div>`];
  if (skipped.length) out.push(SMALL(`${T.skipped} ${skipped.map((s) => fmtDay(s, lang)).join(', ')}`));
  return out;
}

function details(b: Booking, c?: Category, extra: [string, string][] = [], lang: Lang = 'de'): Block {
  const L = MAIL_TEXT[lang].labels;
  const eur = (n: number) => eurL(n, lang);
  const rows: [string, string][] = [
    [L.booking, b.number], [L.occasion, esc(b.title)], [L.date, `${fmtLong(b.start, lang)}<br>${berlinHm(b.start)}–${berlinHm(b.end)}${L.uhr}${berlinYmd(b.end) !== berlinYmd(b.start) ? ` (${L.until} ${fmtDay(b.end, lang)})` : ''}`],
    ...(c ? [[L.kind, esc(catLabel(lang, c).name)] as [string, string]] : []), [L.people, String(b.guests)],
    ...(b.equipment.length ? [[L.equipment, esc(b.equipment.join(', '))] as [string, string]] : []),
    ...(b.rent > 0 ? [[L.rent, eur(b.rent)] as [string, string]] : []), ...(b.deposit > 0 ? [[L.deposit, eur(b.deposit)] as [string, string]] : []),
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
  const M = MAIL_TEXT[b.lang], eur = (n: number) => eurL(n, b.lang);
  const pay = (await getExtras()).payment;
  const until = dueDate(b.start, pay.dueDays);
  const lines = [due.rent > 0 ? `${M.labels.rent} ${eur(due.rent)}` : '', due.deposit > 0 ? `${M.labels.deposit} ${eur(due.deposit)}` : ''].filter(Boolean).join(' + ');
  const total = due.rent > 0 && due.deposit > 0 ? ` = <b>${eur(due.total)}</b>` : '';
  const ways = M.waysTransfer + (pay.paypal && pay.paypalMe ? M.waysPaypal : '') + (pay.stripe ? M.waysOnline : '');
  return [P(M.pay(lines, total, until <= Date.now() ? M.payBeforeHandover : M.payUntil(fmtLong(until, b.lang)), ways))];
}
const manageLink = (b: Booking) => `${appUrl()}/buchung/${b.manageToken}`;
const ics = (b: Booking, c?: Category): Attachment[] => [{ filename: `jugendraum-${b.number}.ics`, content: Buffer.from(bookingIcs(b, c)).toString('base64') }];
/** Stille Buchungen (vom Team für andere eingetragen) bekommen keine automatischen Mails. */
const bookerTo = (b: Booking) => (b.silent ? [] : [b.email]);
const firstName = (n: string) => esc(n.split(' ')[0]);

/** Standardtexte (Deutsch). Das Orga-Team kann sie in der Verwaltung überschreiben; englische und türkische Mails nutzen ihre Standardtexte. */
export const DEFAULT_TEXTS: Record<MailTextKey, string> = {
  received: MAIL_TEXT.de.received.text, confirmed: MAIL_TEXT.de.confirmed.text, rejected: MAIL_TEXT.de.rejected.text,
  reminder: MAIL_TEXT.de.reminder.text, followup: MAIL_TEXT.de.followup.text,
};
export const TEXT_LABELS: Record<MailTextKey, string> = {
  received: 'Anfrage eingegangen', confirmed: 'Buchung bestätigt', rejected: 'Anfrage abgelehnt', reminder: 'Erinnerung vor dem Termin', followup: 'Nachfrage nach dem Termin',
};
async function text(k: MailTextKey, lang: Lang) {
  if (lang !== 'de') return MAIL_TEXT[lang][k].text;
  try { return (await getExtras()).mailTexts[k]?.trim() || DEFAULT_TEXTS[k]; } catch { return DEFAULT_TEXTS[k]; }
}
const hello = (b: { name: string; lang?: Lang }) => MAIL_TEXT[b.lang ?? 'de'].hello(firstName(b.name));
const when = (s: number, e: number, lang: Lang) => `${fmtLong(s, lang)}, ${berlinHm(s)}–${berlinHm(e)}${MAIL_TEXT[lang].labels.uhr}`;

// ---------- Mails an Bucher (in der Sprache der Anfrage) ----------
export const mails = {
  verify: (b: Booking, c: Category | undefined, verifyToken: string, series?: { dates: { start: number; end: number }[]; skipped: number[] }) => {
    const M = MAIL_TEXT[b.lang], V = M.verify;
    return sendMail({ kind: 'verify', to: bookerTo(b), bookingId: b.id, number: b.number, subject: V.subject(b.number),
      ...build({ lang: b.lang, preheader: V.pre, heading: V.heading, blocks: [P(hello(b)), P(V.text), details(b, c, [], b.lang), ...(series ? seriesBlock(series.dates, b.lang, series.skipped) : [])], cta: { href: `${appUrl()}/bestaetigen/${verifyToken}`, label: V.cta }, after: [SMALL(V.small)], progress: 1 }) });
  },
  received: async (b: Booking, c?: Category, series: Booking[] = []) => {
    const M = MAIL_TEXT[b.lang];
    return sendMail({ kind: 'received', to: bookerTo(b), bookingId: b.id, number: b.number, subject: M.received.subject(b.title, fmtDay(b.start, b.lang)),
      ...build({ lang: b.lang, preheader: M.received.pre, heading: M.received.heading, blocks: [P(hello(b)), paragraphs(await text('received', b.lang)), details(b, c, [], b.lang), ...seriesBlock(series, b.lang)], cta: { href: manageLink(b), label: M.viewRequest }, progress: 2 }) });
  },
  confirmed: async (b: Booking, c?: Category, series: Booking[] = []) => {
    const M = MAIL_TEXT[b.lang];
    const blocks = [P(hello(b)), paragraphs(await text('confirmed', b.lang)), details(b, c, [[M.labels.contact, esc(b.agreedWith)]], b.lang), ...seriesBlock(series, b.lang), ...(await payBlock(b))];
    const pdf = await hausordnungPdf(b, c, (await getSettings()).capacity, (await getExtras()).operator).catch((e) => { console.error('PDF:', e); return null; });
    return sendMail({ kind: 'confirmed', to: bookerTo(b), bookingId: b.id, number: b.number, subject: M.confirmed.subject(b.title, fmtDay(b.start, b.lang)), attachments: [...(series.length > 1 ? [{ filename: `jugendraum-${b.number}-serie.ics`, content: Buffer.from(bookingIcs(series, c)).toString('base64') }] : ics(b, c)), ...(pdf ? [pdf] : [])],
      ...build({ lang: b.lang, preheader: M.confirmed.pre(fmtLong(b.start, b.lang)), heading: M.confirmed.heading, blocks, cta: { href: manageLink(b), label: M.view }, progress: 3,
        after: [SMALL(`<a href="${googleCalendarLink({ title: `Jugendraum: ${b.title}`, start: b.start, end: b.end, details: `${b.number} · ${manageLink(b)}`, location: 'Jugendraum SV Heepen' })}" style="color:#2E367A">${GCAL_TX[b.lang]}</a> · ${ATTACH_TX[b.lang]}`)] }) });
  },
  changed: async (b: Booking, before: Booking, c?: Category, note?: string) => {
    const M = MAIL_TEXT[b.lang], C = M.changed;
    const blocks = [P(hello(b)), P(C.text(when(before.start, before.end, b.lang))), ...(note ? [P(`<b>${C.note}</b> ${esc(note)}`)] : []), details(b, c, [], b.lang), SMALL(C.small)];
    return sendMail({ kind: 'changed', to: bookerTo(b), bookingId: b.id, number: b.number, subject: C.subject(b.title, fmtDay(b.start, b.lang)), attachments: b.status === 'confirmed' ? ics(b, c) : undefined,
      ...build({ lang: b.lang, preheader: C.pre(when(b.start, b.end, b.lang)), heading: C.heading, blocks, cta: { href: manageLink(b), label: M.view } }) });
  },
  /** Übergabe-/Rückgabeprotokoll als PDF an den Bucher. */
  protocol: async (b: Booking, kind: 'out' | 'in') => {
    const [cats, sigs, x] = await Promise.all([getCategories(), getSignatures(b.id), getExtras()]);
    const c = cats.find((k) => k.id === b.categoryId);
    const pdf = await protocolPdf(b, c, sigs, x.operator);
    const T = PROTO_TX[b.lang][kind];
    return sendMail({ kind: 'protocol', to: bookerTo(b), bookingId: b.id, number: b.number, subject: T.subject(b.title), attachments: [pdf],
      ...build({ lang: b.lang, preheader: T.text, heading: T.heading, blocks: [P(hello(b)), P(T.text), details(b, c, [], b.lang)], cta: { href: manageLink(b), label: MAIL_TEXT[b.lang].view } }) });
  },
  rejected: async (b: Booking, c?: Category, series: Booking[] = []) => {
    const R = MAIL_TEXT[b.lang].rejected;
    const blocks = [P(hello(b)), paragraphs(await text('rejected', b.lang)), ...(b.rejectReason ? [P(`<b>${R.reason}</b> ${esc(b.rejectReason)}`)] : []), details(b, c, [], b.lang), ...seriesBlock(series, b.lang), P(R.other)];
    return sendMail({ kind: 'rejected', to: bookerTo(b), bookingId: b.id, number: b.number, subject: R.subject(b.title, fmtDay(b.start, b.lang)),
      ...build({ lang: b.lang, preheader: R.pre, heading: R.heading, blocks, cta: { href: appUrl(), label: R.cta } }) });
  },
  cancelled: (b: Booking, c?: Category) => {
    const X = MAIL_TEXT[b.lang].cancelled;
    const blocks = [P(hello(b)), P(X.text), ...(b.rejectReason ? [P(`<b>${X.reason}</b> ${esc(b.rejectReason)}`)] : []), details(b, c, [], b.lang)];
    return sendMail({ kind: 'cancelled', to: bookerTo(b), bookingId: b.id, number: b.number, subject: X.subject(b.title, fmtDay(b.start, b.lang)),
      ...build({ lang: b.lang, preheader: X.pre, heading: X.heading, blocks }) });
  },
  reminder: async (b: Booking, c: Category | undefined, w: '3d' | '1d') => {
    const M = MAIL_TEXT[b.lang], R = M.reminder;
    const blocks = [P(hello(b)), paragraphs(await text('reminder', b.lang)), details(b, c, [[M.labels.contact, esc(b.agreedWith)]], b.lang), ...(await payBlock(b))];
    const label = w === '1d' ? R.tomorrow : R.in3;
    return sendMail({ kind: `reminder-${w}`, to: bookerTo(b), bookingId: b.id, number: b.number, subject: R.subject(label, b.title),
      ...build({ lang: b.lang, preheader: `${label}, ${berlinHm(b.start)}${M.labels.uhr}.`, heading: R.heading(label), blocks, cta: { href: manageLink(b), label: M.view }, progress: 4 }) });
  },
  paid: (b: Booking, amount: number) => {
    const M = MAIL_TEXT[b.lang], X = M.paid, a = eurL(amount, b.lang);
    return sendMail({ kind: 'paid', to: bookerTo(b), bookingId: b.id, number: b.number, subject: X.subject(a, b.number),
      ...build({ lang: b.lang, preheader: X.pre, heading: X.heading, blocks: [P(hello(b)), P(X.text(a, esc(b.title), fmtLong(b.start, b.lang))),
        ...(b.depositPaid && b.deposit > 0 ? [SMALL(X.deposit)] : [])], cta: { href: manageLink(b), label: M.view } }) });
  },
  message: (b: Booking, from: string, body: string) => {
    const X = MAIL_TEXT[b.lang].message;
    return sendMail({ kind: 'message', to: b.email, bookingId: b.id, number: b.number, subject: X.subject(b.number),
      ...build({ lang: b.lang, preheader: body.slice(0, 90), heading: X.heading, blocks: [P(hello(b)), P(X.text(esc(from), esc(b.title), fmtLong(b.start, b.lang))),
        `<div style="margin:0 0 18px;padding:12px 14px;background:#F8F9FB;border-left:3px solid #2E367A;font-size:15px;line-height:1.55;color:#161A33;white-space:pre-wrap">${esc(body)}</div>`,
        SMALL(X.small)], cta: { href: `${manageLink(b)}#nachrichten`, label: X.cta } }) });
  },
  depositRefunded: (b: Booking, amount: number) => {
    const X = MAIL_TEXT[b.lang].refund, a = eurL(amount, b.lang);
    return sendMail({ kind: 'refund', to: bookerTo(b), bookingId: b.id, number: b.number, subject: X.subject(a, b.number),
      ...build({ lang: b.lang, preheader: X.pre, heading: X.heading, blocks: [P(hello(b)), P(X.text(a, esc(b.title)))] }) });
  },
  followup: async (b: Booking) => {
    const X = MAIL_TEXT[b.lang].followup;
    return sendMail({ kind: 'followup', to: bookerTo(b), bookingId: b.id, number: b.number, subject: X.subject(b.title),
      ...build({ lang: b.lang, preheader: X.pre, heading: X.heading, blocks: [P(hello(b)), paragraphs(await text('followup', b.lang))], cta: { href: `${manageLink(b)}/feedback`, label: X.cta } }) });
  },
};

const waitLink = (w: { categoryId: string; start: number; end: number }) =>
  `${appUrl()}/?datum=${berlinYmd(w.start)}&von=${berlinHm(w.start)}&bis=${berlinHm(w.end)}&art=${w.categoryId}`;
export const bookerMails = {
  waitlistJoined: (w: { name: string; email: string; token: string; start: number; end: number; lang?: Lang }) => {
    const lang = w.lang ?? 'de', X = MAIL_TEXT[lang].waitJoined;
    return sendMail({ kind: 'waitlist-joined', to: w.email, subject: X.subject(`${fmtDay(w.start, lang)}, ${berlinHm(w.start)}–${berlinHm(w.end)}${MAIL_TEXT[lang].labels.uhr}`),
      ...build({ lang, preheader: X.pre, heading: X.heading, blocks: [P(hello({ name: w.name, lang })), P(X.text(when(w.start, w.end, lang))), SMALL(X.note), SMALL(X.leave(`${appUrl()}/warteliste/${w.token}`))] }) });
  },
  waitlistFree: (w: { name: string; email: string; categoryId: string; start: number; end: number; lang?: Lang }) => {
    const lang = w.lang ?? 'de', X = MAIL_TEXT[lang].waitFree;
    return sendMail({ kind: 'waitlist-free', to: w.email, subject: X.subject(fmtDay(w.start, lang)),
      ...build({ lang, preheader: X.pre, heading: X.heading, blocks: [P(hello({ name: w.name, lang })), P(X.text(when(w.start, w.end, lang))), SMALL(X.note)], cta: { href: waitLink(w), label: X.cta } }) });
  },
  myBookings: (to: string, link: string, lang: Lang = 'de') => {
    const X = MAIL_TEXT[lang].mine;
    return sendMail({ kind: 'my-bookings', to, subject: X.subject, ...build({ lang, preheader: X.pre, heading: X.heading, blocks: [P(X.text), SMALL(X.small)], cta: { href: link, label: X.cta } }) });
  },
};

// ---------- Mails ans Orga-Team ----------
const adminLink = (b: Booking) => `${appUrl()}/admin/buchung/${b.id}`;
const who = (b: Booking) => `${esc(b.name)} (${b.bookerType === 'member' ? 'Mitglied' + (b.team ? ', ' + esc(b.team) : '') : 'nicht im Verein'}) · ${esc(b.email)} · ${esc(b.phone)}`;
export const teamMails = {
  newRequest: (to: string[], b: Booking, c?: Category, conflicts?: string, series: Booking[] = []) => {
    const blocks = [P(who(b)), ...(series.length > 1 ? [P(`<b>Serienanfrage:</b> ${series.length} Termine`)] : []), details(b, c, [['Abgesprochen mit', esc(b.agreedWith)]]), ...(b.note ? [P(`„${esc(b.note)}“`)] : []),
      ...(conflicts ? [P(`<span style="color:#B42F36"><b>Achtung:</b> ${esc(conflicts)}</span>`)] : [])];
    // Jede Person bekommt eine eigene Mail mit persönlichem Entscheidungslink (ohne Anmeldung nutzbar)
    return Promise.all(to.map((r) => sendMail({ kind: 'team-new', to: r, bookingId: b.id, number: b.number, replyTo: b.email, subject: `Neue Anfrage: ${b.title}, ${fmtDay(b.start)}`,
      ...build({ preheader: `${b.name} fragt ${fmtLong(b.start)} an.`, heading: 'Neue Anfrage', blocks: [...blocks, ...seriesBlock(series, 'de'), SMALL(`Oder <a href="${adminLink(b)}" style="color:#2E367A">in der Verwaltung öffnen</a>.`)],
        cta: { href: `${appUrl()}/entscheiden/${decisionToken(r, b.id)}`, label: 'Bestätigen oder ablehnen' } }) }))).then((x) => x.every(Boolean));
  },
  autoConfirmed: (to: string[], b: Booking, c?: Category) => sendMail({ kind: 'team-info', to, bookingId: b.id, number: b.number, subject: `Eingetragen: ${b.title}, ${fmtDay(b.start)}`,
    ...build({ preheader: 'Automatisch bestätigt.', heading: 'Neuer Termin (automatisch bestätigt)', blocks: [P(who(b)), details(b, c)], cta: { href: adminLink(b), label: 'Ansehen' } }) }),
  cancelled: (to: string[], b: Booking, c?: Category) => sendMail({ kind: 'team-cancelled', to, bookingId: b.id, number: b.number, subject: `Abgesagt: ${b.title}, ${fmtDay(b.start)}`,
    ...build({ preheader: 'Der Termin ist wieder frei.', heading: 'Buchung abgesagt', blocks: [P(`${esc(b.name)} hat abgesagt. Der Termin ist wieder frei.`), details(b, c)], cta: { href: adminLink(b), label: 'Ansehen' } }) }),
  message: (to: string[], b: Booking, body: string) => sendMail({ kind: 'team-message', to, bookingId: b.id, number: b.number, subject: `Nachricht von ${b.name}: ${b.title} (${b.number})`,
    ...build({ preheader: body.slice(0, 90), heading: 'Neue Nachricht', blocks: [P(`${esc(b.name)} schreibt zu „${esc(b.title)}“ (${fmtLong(b.start)}):`),
      `<div style="margin:0 0 18px;padding:12px 14px;background:#F8F9FB;border-left:3px solid #FFD800;font-size:15px;line-height:1.55;color:#161A33;white-space:pre-wrap">${esc(body)}</div>`,
      ...(inboxEnabled() ? [SMALL('Du kannst auch einfach auf diese Mail antworten. Die Antwort geht an den Bucher und erscheint im Verlauf.')] : [])],
      cta: { href: `${adminLink(b)}#nachrichten`, label: 'In der Verwaltung antworten' } }) }),
  damage: (to: string[], b: Booking, comment: string) => sendMail({ kind: 'team-damage', to, bookingId: b.id, number: b.number, replyTo: b.email, subject: `Schaden gemeldet: ${b.title} (${b.number})`,
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
