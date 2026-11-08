import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBooking, getCategories } from '@/lib/data';
import { mails } from '@/lib/mail';
import { clientIp, rateLimited } from '@/lib/ratelimit';
import { addDays, berlinToUtc } from '@/lib/time';

const schema = z.object({
  categoryId: z.string().min(1),
  title: z.string().trim().min(2).max(80),
  note: z.string().trim().max(500).default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  guests: z.coerce.number().int().min(1).max(500),
  bookerType: z.enum(['member', 'external']),
  team: z.string().trim().max(80).default(''),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(4).max(40),
  agreedWith: z.enum(['Michael Grieswelle', 'Sigrid Brodig']),
  agreed: z.literal(true),
  rulesAccepted: z.literal(true),
  website: z.string().max(0).optional(), // Honeypot: Menschen lassen das Feld leer
}).refine((v) => v.bookerType === 'external' || v.team.length > 0, { path: ['team'], message: 'Mannschaft/Abteilung fehlt' });

export async function POST(req: Request) {
  if (rateLimited('book:' + clientIp(req), 8, 60 * 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen in kurzer Zeit. Bitte später noch einmal versuchen.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bitte prüfe deine Angaben.', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const v = parsed.data;
  const start = berlinToUtc(v.date, v.start);
  let end = berlinToUtc(v.date, v.end);
  if (end <= start) end = berlinToUtc(addDays(v.date, 1), v.end);

  const res = await createBooking({ ...v, start, end });
  if (!res.ok) return NextResponse.json({ error: 'Der Zeitraum ist nicht frei.', check: res.check }, { status: 409 });

  const cat = (await getCategories()).find((c) => c.id === v.categoryId);
  await mails.verify(res.booking, cat, res.verifyToken);
  return NextResponse.json({ number: res.booking.number }, { status: 201 });
}
