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

import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lang = await getLang();
  const B = t(lang).booker;
  const [row] = await db()`select manage_token, status from bookings where verify_token = ${token}`;
  if (!row) {
    return (
      <main className="wrap narrow" style={{ paddingBlock: 40 }}>
        <div className="card card-body stack"><h1 style={{ fontSize: '1.5rem' }}>{B.invalidTitle}</h1>
          <p>{B.invalidText}</p>
          <a className="btn btn-primary" href="/" style={{ justifySelf: 'start' }}>{B.newRequest}</a></div>
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
          <span className="eyebrow">{t(lang).app.requestNo} <span className="refno">{b.number}</span></span>
          <div className="inline"><MailCheck className="icon" style={{ color: 'var(--brand-ink)' }} /><h1 style={{ fontSize: '1.5rem' }}>{B.confirmTitle}</h1></div>
          <p className="muted">{B.confirmLead}</p>
          <BookingFacts b={b} cat={cat} lang={lang} />
        </div>
        <form action={confirm} className="card-foot inline">
          <input type="hidden" name="token" value={token} />
          <button className="btn btn-primary btn-lg" type="submit">{B.confirmTitle}</button>
        </form>
      </section>
    </main>
  );
}
