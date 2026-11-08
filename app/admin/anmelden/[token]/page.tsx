import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { consumeLoginToken, sessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Anmelden', robots: { index: false } };

async function login(formData: FormData) {
  'use server';
  const value = await consumeLoginToken(String(formData.get('token')));
  if (!value) redirect('/admin/anmelden/ungueltig');
  (await cookies()).set(sessionCookie.name, value, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: sessionCookie.maxAge });
  redirect('/admin');
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invalid = token === 'ungueltig';
  return (
    <main className="wrap" style={{ paddingBlock: 56, maxWidth: 460 }}>
      <section className="card"><div className="card-body stack">
        <span className="eyebrow">Jugendraum · Verwaltung</span>
        {invalid ? (
          <><h1 style={{ fontSize: '1.5rem' }}>Link abgelaufen</h1><p className="muted">Der Anmeldelink ist abgelaufen oder wurde schon benutzt.</p><a className="btn btn-primary" href="/admin/anmelden" style={{ justifySelf: 'start' }}>Neuen Link anfordern</a></>
        ) : (
          <form action={login} className="stack">
            <h1 style={{ fontSize: '1.5rem' }}>Anmeldung bestätigen</h1>
            <p className="muted">Ein Klick, und du bist in der Verwaltung angemeldet. Die Anmeldung bleibt 30 Tage auf diesem Gerät gespeichert.</p>
            <input type="hidden" name="token" value={token} />
            <button className="btn btn-primary btn-lg" type="submit">Jetzt anmelden</button>
          </form>
        )}
      </div></section>
    </main>
  );
}
