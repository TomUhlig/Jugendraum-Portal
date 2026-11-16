import { NextResponse, type NextRequest } from 'next/server';

/** Wartungsmodus: mit WARTUNG=1 sehen Besucher eine Hinweisseite. Verwaltung, Status und Cron laufen weiter. */
export function middleware(req: NextRequest) {
  if (process.env.WARTUNG !== '1') return NextResponse.next();
  const p = req.nextUrl.pathname;
  if (p.startsWith('/admin') || p.startsWith('/api/cron') || p.startsWith('/api/stripe') || p === '/status' || p === '/wartung') return NextResponse.next();
  if (p.startsWith('/api/')) return NextResponse.json({ error: 'Wartung, bitte gleich noch einmal versuchen.' }, { status: 503, headers: { 'Retry-After': '600' } });
  const url = req.nextUrl.clone(); url.pathname = '/wartung'; url.search = '';
  return NextResponse.rewrite(url, { status: 503, headers: { 'Retry-After': '600' } });
}
export const config = { matcher: ['/((?!_next/|favicon|logo.png|icon-|manifest|sw.js|fotos/).*)'] };
