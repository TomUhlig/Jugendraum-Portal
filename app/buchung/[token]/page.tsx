import { CalendarPlus, CheckCircle2, MessageSquareText } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { BookingFacts } from '@/components/BookingFacts';
import { StatusBadge } from '@/components/StatusBadge';
import { cancelByBooker, getBookingByToken, getCategories, getFeedback } from '@/lib/data';
import { afterBookerCancel } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Deine Buchung', robots: { index: false } };

async function cancel(formData: FormData) {
  'use server';
  const token = String(formData.get('token'));
  if (formData.get('sure') !== 'on') redirect(`/buchung/${token}?fehler=1#absagen`);
  const b = await cancelByBooker(token);
  if (b) await afterBookerCancel(b);
  redirect(`/buchung/${token}?storniert=1`);
}

export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params; const sp = await searchParams;
  const b = await getBookingByToken(token);
  if (!b) notFound();
  const [cats, fb] = await Promise.all([getCategories(), getFeedback(b.id)]);
  const cat = cats.find((c) => c.id === b.categoryId);
  const active = ['pending_email', 'requested', 'confirmed'].includes(b.status);
  const future = b.start > Date.now();
  const past = b.end < Date.now();

  const steps: { label: string; state: 'done' | 'current' | 'failed' | ''; note?: string }[] = [
    { label: 'Anfrage gestellt', state: 'done' },
    { label: 'E-Mail bestätigt', state: b.status === 'pending_email' ? 'current' : b.status === 'expired' ? 'failed' : 'done', note: b.status === 'pending_email' ? 'Bitte klicke auf den Link in unserer Mail.' : b.status === 'expired' ? 'Nicht rechtzeitig bestätigt, die Anfrage ist verfallen.' : undefined },
    { label: b.status === 'rejected' ? 'Abgelehnt' : b.status === 'cancelled' ? 'Storniert' : 'Vom Orga-Team bestätigt',
      state: b.status === 'confirmed' ? 'done' : b.status === 'requested' ? 'current' : ['rejected', 'cancelled'].includes(b.status) ? 'failed' : '',
      note: b.status === 'requested' ? 'Das Orga-Team prüft deine Anfrage.' : b.rejectReason ?? undefined },
    { label: 'Termin', state: b.status === 'confirmed' ? (past ? 'done' : 'current') : '' },
  ];

  return (
    <main className="wrap narrow" style={{ paddingBlock: 32 }}>
      <div className="stack">
        {sp.bestaetigt && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div><strong>Danke, deine E-Mail-Adresse ist bestätigt.</strong> {b.status === 'confirmed' ? 'Der Termin ist eingetragen, die Bestätigung liegt in deinem Postfach.' : 'Das Orga-Team meldet sich bei dir.'}</div></div>}
        {sp.storniert && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div>Die Buchung ist storniert. Der Termin ist wieder frei.</div></div>}
        {sp.danke && <div className="alert alert-ok"><CheckCircle2 className="icon" /><div>Danke für deine Rückmeldung!</div></div>}

        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Buchung <span className="refno">{b.number}</span></span><h1 style={{ fontSize: '1.4rem' }}>{b.title}</h1></div><StatusBadge status={b.status} /></div>
          <div className="card-body grid-2b">
            <BookingFacts b={b} cat={cat} />
            <ol className="timeline" aria-label="Status">
              {steps.map((s) => <li key={s.label} className={s.state}><div><b>{s.label}</b>{s.note && <div className="when">{s.note}</div>}</div></li>)}
            </ol>
          </div>
          {b.status === 'confirmed' && future && (
            <div className="card-foot inline"><a className="btn" href={`/buchung/${token}/kalender`}><CalendarPlus className="icon-sm" />In den Kalender übernehmen</a></div>
          )}
        </section>

        {b.status === 'confirmed' && past && (
          <section className="card card-body stack">
            <div className="inline"><MessageSquareText className="icon" style={{ color: 'var(--brand-ink)' }} /><h2 className="section-title">Wie war es?</h2></div>
            {fb ? <p className="muted">Du hast uns {fb.rating} von 5 Punkten gegeben. Danke!</p> : <p className="muted">Hilf uns mit einer kurzen Rückmeldung, auch wenn etwas kaputtgegangen ist.</p>}
            <a className="btn" href={`/buchung/${token}/feedback`} style={{ justifySelf: 'start' }}>{fb ? 'Rückmeldung ändern' : 'Rückmeldung geben'}</a>
          </section>
        )}

        {active && future && (
          <section className="card card-body stack" id="absagen">
            <h2 className="section-title">Termin absagen</h2>
            <p className="muted small">Wenn du den Raum nicht mehr brauchst, sag bitte ab, damit andere ihn nutzen können. Das Orga-Team wird automatisch informiert.</p>
            <form action={cancel} className="stack-sm">
              <input type="hidden" name="token" value={token} />
              <label className="check-inline"><input type="checkbox" name="sure" /> Ja, ich möchte diese Buchung absagen.</label>
              {sp.fehler && <span className="field-error">Bitte setze zuerst den Haken.</span>}
              <button className="btn btn-danger" type="submit" style={{ justifySelf: 'start' }}>Buchung absagen</button>
            </form>
          </section>
        )}
        <p className="muted small" style={{ textAlign: 'center' }}>Diese Seite ist nur über deinen persönlichen Link erreichbar. Bitte gib ihn nicht weiter.</p>
      </div>
    </main>
  );
}
