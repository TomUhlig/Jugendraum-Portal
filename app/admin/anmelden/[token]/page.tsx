import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { consumeLoginToken, sessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Anmelden', robots: { index: false } };

async function login(formData: FormData) {
  'use server';
  const value = await consumeLoginToken(String(formData.get('token')));
  if (!value) redirect('/admin/anmelden/ungueltig');
  (await cookies()).set(sessionCookie.name, value, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: sessionCookie.maxAge,
  });
  redirect('/admin');
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invalid = token === 'ungueltig';
  return (
    <main className="wrap narrow" style={{ paddingBlock: 40 }}>
      <div className="panel stack">
        <span className="ribbon" style={{ justifySelf: 'start' }}>Verwaltung</span>
        {invalid ? (
          <><h1 style={{ fontSize: '1.8rem' }}>Link abgelaufen</h1><p>Der Login-Link ist abgelaufen oder wurde schon benutzt. <a href="/admin/anmelden">Neuen Link anfordern</a></p></>
        ) : (
          <form action={login} className="stack">
            <h1 style={{ fontSize: '1.8rem' }}>Willkommen zurück</h1>
            <input type="hidden" name="token" value={token} />
            <button className="cta" type="submit">Jetzt anmelden</button>
          </form>
        )}
      </div>
    </main>
  );
}
