import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { getBookingByToken, getCategories, getExtras, listPayments } from '@/lib/data';
import { getLang } from '@/lib/lang';
import { LOCALE } from '@/lib/i18n';
import { berlinHm, fmtDay, fmtLong } from '@/lib/time';
import { PrintLink } from '@/components/PrintLink';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zahlungsbestätigung', robots: { index: false } };

const TX = {
  de: { title: 'Zahlungsbestätigung', back: 'Zurück zur Buchung', print: 'Drucken / als PDF speichern', booking: 'Buchung', for: 'Für', event: 'Termin', received: 'Erhalten', rent: 'Nutzungsentgelt', deposit: 'Kaution', depositBack: 'Kaution zurückgezahlt', withheld: 'davon einbehalten', total: 'Summe erhalten', via: { stripe: 'online (Karte/Lastschrift)', manual: 'Überweisung oder bar' }, none: 'Für diese Buchung ist noch keine Zahlung verbucht.', note: 'Diese Bestätigung wurde automatisch erstellt und ist ohne Unterschrift gültig. Es handelt sich um eine Zahlungsbestätigung, nicht um eine Rechnung.', date: 'Stand', on: 'am' },
  en: { title: 'Payment receipt', back: 'Back to booking', print: 'Print / save as PDF', booking: 'Booking', for: 'For', event: 'Date', received: 'Received', rent: 'Usage fee', deposit: 'Deposit', depositBack: 'Deposit refunded', withheld: 'of which withheld', total: 'Total received', via: { stripe: 'online (card/direct debit)', manual: 'bank transfer or cash' }, none: 'No payment has been recorded for this booking yet.', note: 'This receipt was generated automatically and is valid without signature. It confirms payment and is not an invoice.', date: 'As of', on: 'on' },
  tr: { title: 'Ödeme makbuzu', back: 'Rezervasyona dön', print: 'Yazdır / PDF olarak kaydet', booking: 'Rezervasyon', for: 'Kime', event: 'Tarih', received: 'Alınan', rent: 'Kullanım ücreti', deposit: 'Depozito', depositBack: 'Depozito iade edildi', withheld: 'kesilen kısım', total: 'Toplam alınan', via: { stripe: 'çevrimiçi (kart/otomatik ödeme)', manual: 'havale veya nakit' }, none: 'Bu rezervasyon için henüz ödeme kaydedilmedi.', note: 'Bu makbuz otomatik oluşturulmuştur ve imzasız geçerlidir. Fatura değil, ödeme onayıdır.', date: 'Tarih', on: '' },
} as const;

export default async function Quittung({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await getBookingByToken(token);
  if (!b) notFound();
  const lang = b.lang ?? (await getLang());
  const T = TX[lang as keyof typeof TX] ?? TX.en;
  const [cats, x, pays] = await Promise.all([getCategories(), getExtras(), listPayments(b.id)]);
  const cat = cats.find((c) => c.id === b.categoryId);
  const op = x.operator;
  const money = (n: number) => n.toLocaleString(LOCALE[lang], { style: 'currency', currency: 'EUR' });
  const paid = pays.filter((p) => p.status === 'paid' || p.status === 'refunded');
  const viaFor = (part: 'rent' | 'deposit') => {
    const p = paid.find((q) => q.parts.includes(part));
    return p ? `${T.via[p.provider]}${p.paidAt ? `, ${T.on} ${fmtDay(p.paidAt, lang)}` : ''}` : T.via.manual;
  };
  const lines: { label: string; sub: string; amount: number }[] = [];
  if (b.rentPaid && b.rent > 0) lines.push({ label: T.rent, sub: viaFor('rent'), amount: b.rent });
  if (b.depositPaid && b.deposit > 0) lines.push({ label: T.deposit, sub: viaFor('deposit'), amount: b.deposit });
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <main className="wrap" style={{ paddingBlock: 24, maxWidth: 820 }}>
      <div className="no-print between" style={{ marginBottom: 16 }}>
        <Link href={`/buchung/${token}`} className="inline small" style={{ textDecoration: 'none' }}><ArrowLeft className="icon-sm" />{T.back}</Link>
        <PrintLink label={T.print} icon={<Printer className="icon-sm" />} />
      </div>
      <article className="print-doc">
        <header className="pd-head">
          <img src="/logo.png" alt="" width={56} height={56} />
          <div><div className="pd-kicker">{op.name || 'SV Heepen'}</div><h1>{T.title}</h1></div>
          <div className="pd-ref">{T.booking}<br /><b>{b.number}</b></div>
        </header>
        <table className="pd-table" style={{ marginTop: 16 }}><tbody>
          <tr><th>{T.for}</th><td>{b.name}{b.team ? ` · ${b.team}` : ''}</td></tr>
          <tr><th>{T.event}</th><td><b>{b.title}</b> ({cat?.name ?? ''})<br />{fmtLong(b.start, lang)}, {berlinHm(b.start)}–{berlinHm(b.end)}</td></tr>
        </tbody></table>
        {lines.length === 0 ? <p className="pd-note">{T.none}</p> : (
          <table className="pd-grid receipt" style={{ marginTop: 18 }}>
            <thead><tr><th>{T.received}</th><th style={{ textAlign: 'right' }}>€</th></tr></thead>
            <tbody>
              {lines.map((l) => <tr key={l.label}><td><b>{l.label}</b><br /><small>{l.sub}</small></td><td className="num" style={{ textAlign: 'right' }}>{money(l.amount)}</td></tr>)}
              <tr className="sum"><td><b>{T.total}</b></td><td className="num" style={{ textAlign: 'right' }}><b>{money(total)}</b></td></tr>
              {b.depositReturned && <tr><td>{T.depositBack}{b.depositWithheld > 0 ? ` (${T.withheld}: ${money(b.depositWithheld)})` : ''}</td><td className="num" style={{ textAlign: 'right' }}>−{money(b.deposit - b.depositWithheld)}</td></tr>}
            </tbody>
          </table>
        )}
        <p className="pd-note">{T.note}</p>
        <footer className="pd-foot">{[op.name, op.address.replace(/\n/g, ', '), op.email].filter(Boolean).join(' · ')} · {T.date}: {fmtDay(Date.now(), lang)}</footer>
      </article>
    </main>
  );
}
