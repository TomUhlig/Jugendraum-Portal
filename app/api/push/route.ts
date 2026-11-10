import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/auth';
import { pushAdmin, removeSubscription, saveSubscription } from '@/lib/push';

/** Gerät für Push an- oder abmelden, Test-Push senden. */
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.action === 'subscribe' && body.subscription?.endpoint && body.subscription?.keys?.p256dh) {
    await saveSubscription(admin.id, body.subscription, String(body.device ?? ''));
    const n = await pushAdmin(admin.id, { title: 'Push ist aktiv', body: 'Auf diesem Gerät bekommst du jetzt Benachrichtigungen zum Jugendraum.', url: '/admin', tag: 'test' });
    return NextResponse.json({ ok: true, sent: n });
  }
  if (body.action === 'unsubscribe' && body.endpoint) { await removeSubscription(String(body.endpoint)); return NextResponse.json({ ok: true }); }
  if (body.action === 'test') {
    const n = await pushAdmin(admin.id, { title: 'Test vom Jugendraum', body: 'So sieht eine Benachrichtigung aus.', url: '/admin', tag: 'test' });
    return NextResponse.json({ ok: n > 0, sent: n });
  }
  return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 });
}
