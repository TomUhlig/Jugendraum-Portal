/** Reine Hilfsfunktionen für eingehende Antworten (ohne Netzwerk, testbar). */

/** Buchungsnummer aus Plus-Adresse (name+JR-2026-0001@…) oder Betreff („Re: … JR-2026-0001“). */
export function findBookingNumber(recipients: string[], subject: string): string | null {
  for (const r of recipients) { const m = r.match(/\+(JR-\d{4}-\d{3,6})@/i); if (m) return m[1].toUpperCase(); }
  const s = subject.match(/\b(JR-\d{4}-\d{3,6})\b/i);
  return s ? s[1].toUpperCase() : null;
}

/** Plus-Adresse für Antworten, nur bei Anbietern, die das unterstützen (Gmail, Google Workspace, Outlook.com, iCloud, Posteo, mailbox.org). */
export function plusAddress(mailbox: string, number: string): string | null {
  const [local, domain] = mailbox.toLowerCase().split('@');
  if (!local || !domain || local.includes('+')) return null;
  const ok = /^(gmail\.com|googlemail\.com|outlook\.(com|de)|hotmail\.(com|de)|icloud\.com|posteo\.(de|net)|mailbox\.org)$/.test(domain) || process.env.MAIL_PLUS_ADDRESSING === '1';
  return ok ? `${local}+${number}@${domain}` : null;
}

const QUOTE_START = [
  /^\s*(Am|On|Le|El|Il|Op)\s.{3,200}(schrieb|wrote|a écrit|escribió|ha scritto|schreef)\s*.*:?\s*$/i,
  /^\s*-{2,}\s*(Original|Ursprüngliche|Weitergeleitete|Forwarded)/i,
  /^\s*_{5,}\s*$/,
  /^\s*(Von|From|Gesendet|Sent):\s/i,
  /^\s*>/,
];

/** Nur den neuen Text einer Antwort behalten: Zitat, Signatur und „Von meinem iPhone gesendet“ entfernen. */
export function stripReply(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Gmail bricht „Am … schrieb“ manchmal auf zwei Zeilen um
    const two = i + 1 < lines.length ? `${l} ${lines[i + 1]}` : l;
    if (QUOTE_START.some((re) => re.test(l)) || (/^\s*(Am|On)\s/i.test(l) && QUOTE_START[0].test(two))) break;
    if (/^--\s?$/.test(l)) break;
    out.push(l);
  }
  return out.join('\n')
    .replace(/\n*(Von meinem \w+ gesendet|Sent from my \w+|Gesendet von \w+.*|iPhone'umdan gönderildi)\s*$/i, '')
    .replace(/\n{3,}/g, '\n\n').trim();
}

export const AUTO_IMAP: Record<string, string> = {
  'smtp.gmail.com': 'imap.gmail.com', 'mail.gmx.net': 'imap.gmx.net', 'smtp.gmx.net': 'imap.gmx.net', 'smtp.web.de': 'imap.web.de',
  'smtp.office365.com': 'outlook.office365.com', 'smtp-mail.outlook.com': 'outlook.office365.com', 'securesmtp.t-online.de': 'secureimap.t-online.de',
  'smtp.mail.me.com': 'imap.mail.me.com', 'posteo.de': 'posteo.de', 'smtp.mailbox.org': 'imap.mailbox.org',
};
export function imapConfig() {
  const host = process.env.IMAP_HOST?.trim() || AUTO_IMAP[(process.env.SMTP_HOST ?? '').trim().toLowerCase()];
  const user = process.env.IMAP_USER?.trim() || process.env.SMTP_USER?.trim();
  const pass = process.env.IMAP_PASS?.trim() || process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass || process.env.IMAP_DISABLED === '1') return null;
  return { host, port: Number(process.env.IMAP_PORT || 993), user, pass, secure: process.env.IMAP_TLS !== '0' };
}
export const inboxEnabled = () => !!imapConfig();
