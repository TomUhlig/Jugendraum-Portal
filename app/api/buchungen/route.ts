import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBooking, createSeriesRequest, getCategories } from '@/lib/data';
import { describeSeries, seriesDates } from '@/lib/series';
import { mails } from '@/lib/mail';
import { clientIp, rateLimited } from '@/lib/ratelimit';
import { checkHuman } from '@/lib/antispam';
import { isLang, t } from '@/lib/i18n';
import { addDays, berlinToUtc } from '@/lib/time';

const schema = z.object({
  categoryId: z.string().min(1),
  title: z.string().trim().min(2).max(80),
  note: z.string().trim().max(500).default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  guests: z.coerce.number().int().min(1).max(500),
  equipment: z.array(z.string().max(60)).max(20).default([]),
  bookerType: z.enum(['member', 'external']),
  team: z.string().trim().max(80).default(''),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(4).max(40),
  agreedWith: z.enum(['Michael Grieswelle', 'Sigrid Brodig']),
  agreed: z.literal(true),
  rulesAccepted: z.literal(true),
  website: z.string().max(0).optional(),
  elapsed: z.coerce.number().optional(),
  turnstile: z.string().max(4000).optional(),
  lang: z.enum(['de', 'en', 'tr']).default('de'),
  alternatives: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })).max(2).default([]),
  repeat: z.object({ freq: z.enum(['weekly', 'biweekly']), count: z.coerce.number().int().min(2).max(12) }).optional(), // Honeypot: Menschen lassen das Feld leer
}).refine((v) => v.bookerType === 'external' || v.team.length > 0, { path: ['team'], message: 'Mannschaft/Abteilung fehlt' });

export async function POST(req: Request) {
  if (rateLimited('book:' + clientIp(req), 8, 60 * 60_000)) {
    return NextResponse.json({ error: t('de').api.tooMany + ' / ' + t('en').api.tooMany }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const L = t(isLang(body?.lang) ? body.lang : 'de').api;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: L.check, fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const v = parsed.data;
  const human = await checkHuman({ elapsed: v.elapsed, turnstile: v.turnstile, ip: clientIp(req), lang: v.lang });
  if (human) return NextResponse.json({ error: human }, { status: 400 });
  const start = berlinToUtc(v.date, v.start);
  let end = berlinToUtc(v.date, v.end);
  if (end <= start) end = berlinToUtc(addDays(v.date, 1), v.end);

  const cat = (await getCategories()).find((c) => c.id === v.categoryId);
  if (v.repeat && cat && !cat.isParty) {
    // Serie: gleiche Uhrzeit an jedem Termin
    const days = seriesDates(v.date, v.repeat.freq, { count: v.repeat.count });
    const len = end - start;
    const slots = days.map((d) => { const s = berlinToUtc(d, v.start); return { start: s, end: s + len }; });
    const rule = describeSeries(v.date, v.repeat.freq, days[0], days[days.length - 1], days.length);
    const res = await createSeriesRequest({ ...v, start, end, alternatives: [] }, slots, rule);
    if (!res.ok) return NextResponse.json({ error: L.notFree, check: res.check }, { status: 409 });
    await mails.verify(res.booking, cat, res.verifyToken, { dates: res.dates, skipped: res.skipped });
    return NextResponse.json({ number: res.booking.number, count: res.dates.length, skipped: res.skipped }, { status: 201 });
  }

  const toSlot = (a: { date: string; start: string; end: string }) => {
    const s = berlinToUtc(a.date, a.start); let e = berlinToUtc(a.date, a.end); if (e <= s) e = berlinToUtc(addDays(a.date, 1), a.end); return { start: s, end: e };
  };
  const alternatives = v.alternatives.map(toSlot).filter((a) => a.start !== start);
  const res = await createBooking({ ...v, start, end, alternatives });
  if (!res.ok) return NextResponse.json({ error: L.notFree, check: res.check }, { status: 409 });
  await mails.verify(res.booking, cat, res.verifyToken);
  return NextResponse.json({ number: res.booking.number }, { status: 201 });
}
