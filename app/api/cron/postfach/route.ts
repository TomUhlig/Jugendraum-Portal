import { NextResponse } from 'next/server';
import { pollInbox } from '@/lib/inbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Antworten aus dem Postfach abholen. Für einen externen Dienst (z. B. cron-job.org alle 5 Minuten): ?key=CRON_SECRET */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const key = new URL(req.url).searchParams.get('key') ?? req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!secret || key !== secret) return new NextResponse('Nicht erlaubt', { status: 401 });
  return NextResponse.json(await pollInbox());
}
