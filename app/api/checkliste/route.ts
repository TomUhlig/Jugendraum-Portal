import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CHECKLIST } from '@/lib/checklist';
import { toggleChecklist } from '@/lib/data';
import { clientIp, rateLimited } from '@/lib/ratelimit';

const schema = z.object({ token: z.string().min(10).max(80), item: z.string().max(30), done: z.boolean() });

/** Bucher hakt einen Punkt der Checkliste ab (über den persönlichen Buchungslink). */
export async function POST(req: Request) {
  if (rateLimited('check:' + clientIp(req), 120, 60 * 60_000)) return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 });
  const v = schema.safeParse(await req.json().catch(() => null));
  if (!v.success || !CHECKLIST.some((i) => i.id === v.data.item)) return NextResponse.json({ error: 'Ungültig.' }, { status: 400 });
  const list = await toggleChecklist(v.data.token, v.data.item, v.data.done);
  if (!list) return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 });
  return NextResponse.json({ checklist: list });
}
