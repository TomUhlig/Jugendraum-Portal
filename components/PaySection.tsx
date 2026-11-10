import { CreditCard, Landmark, Wallet } from 'lucide-react';
import type { Booking } from '@/lib/data';
import { amountsDue, getExtras, listPayments } from '@/lib/data';
import { eur } from '@/lib/labels';
import { dueDate, formatIban, isValidIban, paypalLink } from '@/lib/payment';
import { stripeEnabled } from '@/lib/stripe';
import { fmtLong } from '@/lib/time';
import { CopyText } from './CopyText';

/** Bereich „Bezahlen“ auf der Buchungsseite. payOnline ist die Server Action für Stripe. */
export async function PaySection({ b, token, payOnline, notice }: { b: Booking; token: string; payOnline: (fd: FormData) => Promise<void>; notice?: string }) {
  if (b.rent + b.deposit <= 0) return null;
  const [{ payment: pay }, payments] = await Promise.all([getExtras(), listPayments(b.id)]);
  const due = amountsDue(b);
  const paid = payments.filter((p) => p.status !== 'open' && p.status !== 'failed');
  const ref = `${b.number} ${b.name}`.slice(0, 140);
  const transfer = pay.transfer && pay.holder && isValidIban(pay.iban);
  const online = pay.stripe && stripeEnabled();
  const paypal = pay.paypal && pay.paypalMe;

  if (b.status !== 'confirmed') {
    return (
      <section className="card card-body stack-sm" id="bezahlen">
        <h2 className="section-title">Kosten</h2>
        <p className="muted small">{b.rent > 0 && <>Nutzungsentgelt {eur(b.rent)}</>}{b.rent > 0 && b.deposit > 0 && ' · '}{b.deposit > 0 && <>Kaution {eur(b.deposit)}</>}. Bezahlt wird erst, wenn die Buchung bestätigt ist.</p>
      </section>
    );
  }
  return (
    <section className="card" id="bezahlen">
      <div className="card-head"><div><h2>Bezahlen</h2>{due.total > 0 && <p>bis {dueDate(b.start, pay.dueDays) <= Date.now() ? 'zur Schlüsselübergabe' : fmtLong(dueDate(b.start, pay.dueDays))}</p>}</div>
        <span className={`badge ${due.total > 0 ? 'b-warn' : 'b-ok'}`}>{due.total > 0 ? `offen: ${eur(due.total)}` : 'bezahlt'}</span></div>
      <div className="card-body stack">
        {notice && <div className="alert alert-info"><div>{notice}</div></div>}
        <dl className="kv">
          {b.rent > 0 && <><dt>Nutzungsentgelt</dt><dd>{eur(b.rent)} {b.rentPaid ? <span className="badge b-ok">bezahlt</span> : <span className="badge b-warn">offen</span>}</dd></>}
          {b.deposit > 0 && <><dt>Kaution</dt><dd>{eur(b.deposit)} {b.depositPaid ? <span className="badge b-ok">bezahlt</span> : <span className="badge b-warn">offen</span>} <span className="muted small">bekommst du nach der Abnahme zurück</span></dd></>}
        </dl>
        {due.total > 0 && (
          <>
            {online && (
              <form action={payOnline} className="pay-option">
                <input type="hidden" name="token" value={token} />
                <div className="inline"><CreditCard className="icon" /><b>Online bezahlen</b></div>
                <p className="muted small">Karte, PayPal, Apple Pay, Google Pay oder Lastschrift, je nach Angebot. Die Zahlung wird sofort verbucht.</p>
                <button className="btn btn-primary" type="submit">{eur(due.total)} jetzt bezahlen</button>
              </form>
            )}
            {transfer && (
              <div className="pay-option pay-transfer">
                <div className="stack-sm">
                  <div className="inline"><Landmark className="icon" /><b>Überweisung</b></div>
                  <dl className="kv small">
                    <dt>Empfänger</dt><dd>{pay.holder}</dd>
                    <dt>IBAN</dt><dd><CopyText text={formatIban(pay.iban)} /></dd>
                    {pay.bic && <><dt>BIC</dt><dd>{pay.bic}</dd></>}
                    <dt>Betrag</dt><dd><b>{eur(due.total)}</b></dd>
                    <dt>Verwendungszweck</dt><dd><CopyText text={ref} /></dd>
                  </dl>
                  <p className="muted small">Die Überweisung wird vom Orga-Team von Hand verbucht, das kann ein paar Tage dauern.</p>
                </div>
                <figure className="girocode"><img src={`/buchung/${token}/girocode`} alt="GiroCode für die Überweisung" width={150} height={150} /><figcaption>Mit der Banking-App scannen</figcaption></figure>
              </div>
            )}
            {paypal && (
              <div className="pay-option">
                <div className="inline"><Wallet className="icon" /><b>PayPal</b></div>
                <p className="muted small">Bitte als Nachricht <b>{b.number}</b> angeben. Wird von Hand verbucht.</p>
                <a className="btn" href={paypalLink(pay.paypalMe, due.total)} rel="noopener" target="_blank">Mit PayPal {eur(due.total)} senden</a>
              </div>
            )}
            {!online && !transfer && !paypal && <p className="muted">Die Bezahlung klärst du direkt mit deiner Ansprechperson.</p>}
            {pay.note && <p className="muted small">{pay.note}</p>}
          </>
        )}
        {paid.length > 0 && <p className="muted small">Eingegangen: {paid.map((p) => `${eur(p.amount)} am ${p.paidAt ? fmtLong(p.paidAt) : ''}${p.refunded > 0 ? ` (davon ${eur(p.refunded)} erstattet)` : ''}`).join(' · ')}</p>}
      </div>
    </section>
  );
}
