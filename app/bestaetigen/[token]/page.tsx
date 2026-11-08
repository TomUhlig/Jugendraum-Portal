import { redirect } from 'next/navigation';
import { TicketCard } from '@/components/TicketCard';
import { db } from '@/lib/db';
import { getBookingByToken, getCategories, verifyBooking } from '@/lib/data';
import { afterVerified } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Anfrage bestätigen', robots: { index: false } };

// Bestätigung per Knopfdruck (nicht beim Öffnen des Links), damit Mail-Scanner nichts auslösen.
async function confirm(formData: FormData) {
  'use server';
  const token = String(formData.get('token'));
  const r = await verifyBooking(token);
  if (!r) redirect('/');
  if (r.fresh) await afterVerified(r.booking);
  redirect(`/buchung/${r.booking.manageToken}?bestaetigt=1`);
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db()`select manage_token, status from bookings where verify_token = ${token}`;
  if (!row) return <main className="wrap narrow" style={{ paddingBlock: 40 }}><h1>Link ungültig</h1><p>Dieser Bestätigungslink ist unbekannt oder abgelaufen. <a href="/">Neue Anfrage stellen</a></p></main>;
  if (row.status !== 'pending_email') redirect(`/buchung/${row.manage_token}`);
  const b = (await getBookingByToken(row.manage_token))!;
  const cat = (await getCategories()).find((c) => c.id === b.categoryId);
  return (
    <main className="wrap narrow" style={{ paddingBlock: 32, display: 'grid', justifyItems: 'center' }}>
      <TicketCard b={b} cat={cat} heading="Anfrage bestätigen">
        <p style={{ margin: 0 }}>Stimmt alles? Dann schick die Anfrage jetzt an das Orga-Team.</p>
        <form action={confirm}>
          <input type="hidden" name="token" value={token} />
          <button className="cta" type="submit">Jetzt bestätigen</button>
        </form>
      </TicketCard>
    </main>
  );
}
