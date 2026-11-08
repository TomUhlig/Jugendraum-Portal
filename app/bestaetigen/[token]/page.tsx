import { MailCheck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { BookingFacts } from '@/components/BookingFacts';
import { db } from '@/lib/db';
import { getBookingByToken, getCategories, verifyBooking } from '@/lib/data';
import { afterVerified } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Anfrage bestätigen', robots: { index: false } };

// Bestätigung per Knopfdruck (nicht schon beim Öffnen), damit Virenscanner in Mailprogrammen nichts auslösen.
async function confirm(formData: FormData) {
  'use server';
  const r = await verifyBooking(String(formData.get('token')));
  if (!r) redirect('/');
  if (r.fresh) await afterVerified(r.booking);
  redirect(`/buchung/${r.booking.manageToken}?bestaetigt=1`);
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db()`select manage_token, status from bookings where verify_token = ${token}`;
  if (!row) {
    return (
      <main className="wrap narrow" style={{ paddingBlock: 40 }}>
        <div className="card card-body stack"><h1 style={{ fontSize: '1.5rem' }}>Dieser Link ist nicht mehr gültig</h1>
          <p>Der Bestätigungslink ist unbekannt oder die Anfrage ist bereits verfallen. Du kannst einfach eine neue Anfrage stellen.</p>
          <a className="btn btn-primary" href="/" style={{ justifySelf: 'start' }}>Neue Anfrage</a></div>
      </main>
    );
  }
  if (row.status !== 'pending_email') redirect(`/buchung/${row.manage_token}`);
  const b = (await getBookingByToken(row.manage_token))!;
  const cat = (await getCategories()).find((c) => c.id === b.categoryId);
  return (
    <main className="wrap narrow" style={{ paddingBlock: 40 }}>
      <section className="card">
        <div className="card-body stack">
          <span className="eyebrow">Anfrage <span className="refno">{b.number}</span></span>
          <div className="inline"><MailCheck className="icon" style={{ color: 'var(--brand-ink)' }} /><h1 style={{ fontSize: '1.5rem' }}>Anfrage bestätigen</h1></div>
          <p className="muted">Bitte prüfe die Angaben. Mit der Bestätigung geht deine Anfrage an das Orga-Team.</p>
          <BookingFacts b={b} cat={cat} />
        </div>
        <form action={confirm} className="card-foot inline">
          <input type="hidden" name="token" value={token} />
          <button className="btn btn-primary btn-lg" type="submit">Anfrage bestätigen</button>
        </form>
      </section>
    </main>
  );
}
