import { notFound, redirect } from 'next/navigation';
import { TicketCard } from '@/components/TicketCard';
import { cancelByBooker, getBookingByToken, getCategories } from '@/lib/data';
import { afterBookerCancel } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Deine Buchung', robots: { index: false } };

async function cancel(formData: FormData) {
  'use server';
  const token = String(formData.get('token'));
  if (formData.get('sure') !== 'on') redirect(`/buchung/${token}?fehler=bestaetigen`);
  const b = await cancelByBooker(token);
  if (b) await afterBookerCancel(b);
  redirect(`/buchung/${token}?storniert=1`);
}

export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params; const sp = await searchParams;
  const b = await getBookingByToken(token);
  if (!b) notFound();
  const cat = (await getCategories()).find((c) => c.id === b.categoryId);
  const canCancel = ['pending_email', 'requested', 'confirmed'].includes(b.status) && b.start > Date.now();
  const heading = { pending_email: 'E-Mail bestätigen', requested: 'Anfrage läuft', confirmed: 'Raum gebucht', rejected: 'Leider abgelehnt', cancelled: 'Storniert', expired: 'Verfallen' }[b.status];
  return (
    <main className="wrap narrow" style={{ paddingBlock: 32, display: 'grid', gap: 16, justifyItems: 'center' }}>
      {sp.bestaetigt && <p className="notice">Danke! Deine E-Mail ist bestätigt. {b.status === 'confirmed' ? 'Der Termin ist eingetragen, die Bestätigung liegt in deinem Postfach.' : 'Das Orga-Team meldet sich bei dir.'}</p>}
      {sp.storniert && <p className="notice">Die Buchung ist storniert. Der Termin ist wieder frei.</p>}
      <TicketCard b={b} cat={cat} heading={heading}>
        {canCancel ? (
          <form action={cancel} style={{ display: 'grid', gap: 10 }}>
            <input type="hidden" name="token" value={token} />
            <label className="toggle"><input type="checkbox" name="sure" /> <span>Ich möchte diese Buchung stornieren.</span></label>
            {sp.fehler && <span className="err">Bitte setze zuerst den Haken.</span>}
            <div className="acts"><button className="btn no" type="submit">Buchung stornieren</button><a className="btn" href="/">Zur Startseite</a></div>
          </form>
        ) : <div className="acts"><a className="btn primary" href="/">Neuen Termin anfragen</a></div>}
      </TicketCard>
      <p className="muted" style={{ fontSize: '.85rem', textAlign: 'center' }}>Diese Seite ist nur über deinen persönlichen Link erreichbar. Bitte nicht weitergeben.</p>
    </main>
  );
}
