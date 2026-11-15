import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Booking, Operator } from './data';
import type { Category } from './rules';
import { catLabel, type Lang } from './i18n';
import { hausordnung, KEY_RULES } from './hausordnung';
import { berlinHm, fmtLong } from './time';

const NAVY = rgb(0x2e / 255, 0x36 / 255, 0x7a / 255), INK = rgb(0x16 / 255, 0x1a / 255, 0x33 / 255), MUTED = rgb(0x64 / 255, 0x6a / 255, 0x85 / 255);
const YELLOW = rgb(1, 0xd8 / 255, 0), LINE = rgb(0xe1 / 255, 0xe4 / 255, 0xec / 255), TINT = rgb(0xf4 / 255, 0xf5 / 255, 0xfa / 255);

const TX = {
  de: { kicker: 'Jugendraum des SV Heepen', title: 'Hausordnung und Infos zu deiner Buchung', booking: 'Deine Buchung', occasion: 'Anlass', when: 'Termin', guests: 'Personen', number: 'Buchungsnummer', contact: 'Abgesprochen mit', rules: 'Hausordnung', key: 'Schlüssel', thanks: 'Danke, dass ihr den Raum so hinterlasst, wie ihr ihn vorfinden möchtet. Viel Spaß!', uhr: ' Uhr', file: 'Hausordnung' },
  en: { kicker: 'SV Heepen youth room', title: 'House rules and information for your booking', booking: 'Your booking', occasion: 'Occasion', when: 'Date', guests: 'People', number: 'Booking number', contact: 'Arranged with', rules: 'House rules', key: 'Key', thanks: 'Thank you for leaving the room the way you would like to find it. Have fun!', uhr: '', file: 'House-rules' },
  tr: { kicker: 'SV Heepen gençlik salonu', title: 'Ev kuralları ve rezervasyon bilgileri', booking: 'Rezervasyonun', occasion: 'Etkinlik', when: 'Tarih', guests: 'Kişi', number: 'Rezervasyon numarası', contact: 'Görüşülen kişi', rules: 'Ev kuralları', key: 'Anahtar', thanks: 'Salonu bulmak istediğiniz gibi bıraktığınız için teşekkürler. İyi eğlenceler!', uhr: '', file: 'Ev-kurallari' },
} as const;

let fontCache: { reg: Uint8Array; bold: Uint8Array; logo: Uint8Array | null } | null = null;
async function assets() {
  if (fontCache) return fontCache;
  const root = process.cwd();
  const [reg, bold, logo] = await Promise.all([
    readFile(path.join(root, 'assets/fonts/SourceSans3-Regular.ttf')),
    readFile(path.join(root, 'assets/fonts/SourceSans3-Bold.ttf')),
    readFile(path.join(root, 'public/logo.png')).catch(() => null),
  ]);
  fontCache = { reg, bold, logo };
  return fontCache;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      const t = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** A4-PDF mit Hausordnung, Schlüsselregeln und den Eckdaten der Buchung (Anhang der Bestätigungsmail). */
export async function hausordnungPdf(b: Booking, cat: Category | undefined, capacity: number, op: Operator): Promise<{ filename: string; content: string }> {
  const lang: Lang = b.lang ?? 'de';
  const T = TX[lang];
  const a = await assets();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${T.rules} · ${b.number}`); doc.setAuthor(op.name || 'SV Heepen'); doc.setLanguage(lang);
  const reg = await doc.embedFont(a.reg, { subset: true }), bold = await doc.embedFont(a.bold, { subset: true });
  const W = 595.28, H = 841.89, M = 56, CW = W - 2 * M;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const ensure = (h: number) => { if (y - h < M + 30) { page = doc.addPage([W, H]); y = H - M; } };

  // Kopf
  if (a.logo) { const img = await doc.embedPng(a.logo); page.drawImage(img, { x: M, y: y - 44, width: 44, height: 44 }); }
  page.drawText(T.kicker, { x: M + 58, y: y - 14, size: 10, font: reg, color: MUTED });
  const titleLines = wrap(T.title, bold, 19, CW - 58);
  titleLines.forEach((l, i) => page.drawText(l, { x: M + 58, y: y - 36 - i * 22, size: 19, font: bold, color: INK }));
  y -= 52 + (titleLines.length - 1) * 22;
  page.drawRectangle({ x: M, y: y - 4, width: CW, height: 3, color: YELLOW });
  y -= 28;

  // Buchung
  const rows: [string, string][] = [
    [T.occasion, `${b.title}${cat ? ` (${catLabel(lang, cat).name})` : ''}`],
    [T.when, `${fmtLong(b.start, lang)}, ${berlinHm(b.start)}–${berlinHm(b.end)}${T.uhr}`],
    [T.guests, String(b.guests)],
    [T.contact, b.agreedWith],
    [T.number, b.number],
  ];
  const boxH = 30 + rows.length * 18;
  page.drawRectangle({ x: M, y: y - boxH, width: CW, height: boxH, color: TINT, borderColor: LINE, borderWidth: 1 });
  page.drawText(T.booking, { x: M + 14, y: y - 20, size: 11, font: bold, color: NAVY });
  rows.forEach(([k, v], i) => {
    const yy = y - 40 - i * 18;
    page.drawText(k, { x: M + 14, y: yy, size: 10, font: reg, color: MUTED });
    page.drawText(wrap(v, bold, 10.5, CW - 160)[0], { x: M + 140, y: yy, size: 10.5, font: bold, color: INK });
  });
  y -= boxH + 30;

  const section = (title: string, items: string[]) => {
    ensure(40);
    page.drawText(title, { x: M, y, size: 13, font: bold, color: NAVY });
    y -= 20;
    items.forEach((it, i) => {
      const lines = wrap(it, reg, 11, CW - 26);
      ensure(lines.length * 15 + 6);
      page.drawCircle({ x: M + 8, y: y + 3.5, size: 8, color: TINT, borderColor: LINE, borderWidth: 0.8 });
      const n = String(i + 1);
      page.drawText(n, { x: M + 8 - bold.widthOfTextAtSize(n, 8) / 2, y: y + 0.8, size: 8, font: bold, color: NAVY });
      lines.forEach((l, j) => page.drawText(l, { x: M + 26, y: y - j * 15, size: 11, font: reg, color: INK }));
      y -= lines.length * 15 + 8;
    });
    y -= 12;
  };
  section(T.rules, hausordnung(capacity, lang));
  section(T.key, KEY_RULES[lang]);

  ensure(40);
  wrap(T.thanks, bold, 11, CW).forEach((l) => { page.drawText(l, { x: M, y, size: 11, font: bold, color: INK }); y -= 15; });

  // Fußzeile auf jeder Seite
  const foot = [op.name, op.address.replace(/\n/g, ', '), op.email, op.phone].filter(Boolean).join(' · ');
  for (const p of doc.getPages()) {
    p.drawLine({ start: { x: M, y: M - 6 }, end: { x: W - M, y: M - 6 }, thickness: 0.6, color: LINE });
    if (foot) p.drawText(wrap(foot, reg, 8.5, CW)[0], { x: M, y: M - 20, size: 8.5, font: reg, color: MUTED });
  }
  const bytes = await doc.save();
  return { filename: `${T.file}-${b.number}.pdf`, content: Buffer.from(bytes).toString('base64') };
}
