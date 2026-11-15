import { CreditCard, Landmark, Wallet } from 'lucide-react';
import type { Booking } from '@/lib/data';
import { amountsDue, getExtras, listPayments } from '@/lib/data';
import { LOCALE, t, type Lang } from '@/lib/i18n';
import { dueDate, formatIban, isValidIban, paypalLink } from '@/lib/payment';
import { stripeEnabled } from '@/lib/stripe';
import { fmtLong } from '@/lib/time';
import { CopyText } from './CopyText';

/** Bereich „Bezahlen“ auf der Buchungsseite. payOnline ist die Server Action für Stripe. */
export async function PaySection({ b, token, payOnline, notice, lang = 'de' }: { b: Booking; token: string; payOnline: (fd: FormData) => Promise<void>; notice?: string; lang?: Lang }) {
  const P = t(lang).pay;
  const eur = (n: number) => n.toLocaleString(LOCALE[lang], { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 });
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
        <h2 className="section-title">{P.costs}</h2>
        <p className="muted small">{b.rent > 0 && <>{t(lang).app.rent} {eur(b.rent)}</>}{b.rent > 0 && b.deposit > 0 && ' · '}{b.deposit > 0 && <>{t(lang).app.deposit} {eur(b.deposit)}</>}. {P.afterConfirm}</p>
      </section>
    );
  }
  return (
    <section className="card" id="bezahlen">
      <div className="card-head"><div><h2>{P.pay}</h2>{due.total > 0 && <p>{dueDate(b.start, pay.dueDays) <= Date.now() ? P.atHandover : P.until(fmtLong(dueDate(b.start, pay.dueDays), lang))}</p>}</div>
        <span className={`badge ${due.total > 0 ? 'b-warn' : 'b-ok'}`}>{due.total > 0 ? P.openAmt(eur(due.total)) : P.paid}</span></div>
      <div className="card-body stack">
        {notice && <div className="alert alert-info"><div>{notice}</div></div>}
        <dl className="kv">
          {b.rent > 0 && <><dt>{t(lang).app.rent}</dt><dd>{eur(b.rent)} {b.rentPaid ? <span className="badge b-ok">{P.paid}</span> : <span className="badge b-warn">{P.open}</span>}</dd></>}
          {b.deposit > 0 && <><dt>{t(lang).app.deposit}</dt><dd>{eur(b.deposit)} {b.depositPaid ? <span className="badge b-ok">{P.paid}</span> : <span className="badge b-warn">{P.open}</span>} <span className="muted small">{P.depositBack}</span></dd></>}
        </dl>
        {due.total > 0 && (
          <>
            {online && (
              <form action={payOnline} className="pay-option">
                <input type="hidden" name="token" value={token} />
                <div className="inline"><CreditCard className="icon" /><b>{P.online}</b></div>
                <p className="muted small">{P.onlineText}</p>
                <button className="btn btn-primary" type="submit">{P.payNow(eur(due.total))}</button>
              </form>
            )}
            {transfer && (
              <div className="pay-option pay-transfer">
                <div className="stack-sm">
                  <div className="inline"><Landmark className="icon" /><b>{P.transfer}</b></div>
                  <dl className="kv small">
                    <dt>{P.recipient}</dt><dd>{pay.holder}</dd>
                    <dt>IBAN</dt><dd><CopyText text={formatIban(pay.iban)} label={P.copy} /></dd>
                    {pay.bic && <><dt>BIC</dt><dd>{pay.bic}</dd></>}
                    <dt>{P.amount}</dt><dd><b>{eur(due.total)}</b></dd>
                    <dt>{P.reference}</dt><dd><CopyText text={ref} label={P.copy} /></dd>
                  </dl>
                  <p className="muted small">{P.transferNote}</p>
                </div>
                <figure className="girocode"><img src={`/buchung/${token}/girocode`} alt="GiroCode" width={150} height={150} /><figcaption>{P.scan}</figcaption></figure>
              </div>
            )}
            {paypal && (
              <div className="pay-option">
                <div className="inline"><Wallet className="icon" /><b>PayPal</b></div>
                <p className="muted small">{P.paypalNote(b.number)}</p>
                <a className="btn" href={paypalLink(pay.paypalMe, due.total)} rel="noopener" target="_blank">{P.paypalSend(eur(due.total))}</a>
              </div>
            )}
            {!online && !transfer && !paypal && <p className="muted">{P.direct}</p>}
            {pay.note && lang === 'de' && <p className="muted small">{pay.note}</p>}
          </>
        )}
        {paid.length > 0 && <p className="muted small">{P.received}: {paid.map((p) => `${eur(p.amount)} ${P.on} ${p.paidAt ? fmtLong(p.paidAt, lang) : ''}${p.refunded > 0 ? ` (${P.refunded(eur(p.refunded))})` : ''}`).join(' · ')}</p>}
      </div>
    </section>
  );
}
