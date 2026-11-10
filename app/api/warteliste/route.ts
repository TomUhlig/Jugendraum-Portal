import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addWaitlist, getCategories } from '@/lib/data';
import { bookerMails } from '@/lib/mail';
import { clientIp, rateLimited } from '@/lib/ratelimit';
import { checkHuman } from '@/lib/antispam';
import { addDays, berlinToUtc } from '@/lib/time';

const schema = z.object({
  categoryId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(120),
  website: z.string().max(0).optional(),
  elapsed: z.coerce.number().optional(),
  turnstile: z.string().max(4000).optional(),
});

/** Auf die Warteliste für einen belegten Termin setzen. */
export async function POST(req: Request) {
  if (rateLimited('wait:' + clientIp(req), 10, 60 * 60_000)) return NextResponse.json({ error: 'Zu viele Versuche. Bitte später noch einmal.' }, { status: 429 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Bitte Name und eine gültige E-Mail-Adresse angeben.' }, { status: 400 });
  const v = p.data;
  const human = await checkHuman({ elapsed: v.elapsed, ip: clientIp(req), captcha: false });
  if (human) return NextResponse.json({ error: human }, { status: 400 });
  if (!(await getCategories()).some((c) => c.id === v.categoryId)) return NextResponse.json({ error: 'Unbekannte Kategorie.' }, { status: 400 });
  const start = berlinToUtc(v.date, v.start);
  const end = v.end > v.start ? berlinToUtc(v.date, v.end) : berlinToUtc(addDays(v.date, 1), v.end);
  if (start < Date.now()) return NextResponse.json({ error: 'Der Termin liegt in der Vergangenheit.' }, { status: 400 });
  const w = await addWaitlist({ categoryId: v.categoryId, start, end, name: v.name, email: v.email });
  await bookerMails.waitlistJoined(w);
  return NextResponse.json({ ok: true }, { status: 201 });
}
