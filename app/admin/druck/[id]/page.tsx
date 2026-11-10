import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PrintButton } from '@/components/PrintButton';
import { requireAdmin } from '@/lib/auth';
import { getBooking, getCategories, getExtras, getSettings } from '@/lib/data';
import { SCHLUESSELREGELN, hausordnung } from '@/lib/hausordnung';
import { eur } from '@/lib/labels';
import { berlinHm, berlinYmd, fmtDay, fmtLong } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nutzungsvereinbarung', robots: { index: false } };

/** Nutzungsvereinbarung mit Übergabe- und Rückgabeprotokoll zum Ausdrucken (A4). */
export default async function Druck({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const b = await getBooking((await params).id);
  if (!b) notFound();
  const [cats, s, x] = await Promise.all([getCategories(), getSettings(), getExtras()]);
  const cat = cats.find((c) => c.id === b.categoryId);
  const op = x.operator;
  const row = (k: string, v: React.ReactNode) => <tr><th>{k}</th><td>{v}</td></tr>;
  return (
    <main className="wrap" style={{ paddingBlock: 24, maxWidth: 900 }}>
      <div className="no-print between" style={{ marginBottom: 16 }}>
        <Link href={`/admin/buchung/${b.id}`} className="inline small" style={{ textDecoration: 'none' }}><ArrowLeft className="icon-sm" />Zurück zur Buchung</Link>
        <PrintButton />
      </div>
      <article className="print-doc">
        <header className="pd-head">
          <img src="/logo.png" alt="" width={56} height={56} />
          <div><div className="pd-kicker">Jugendraum des SV Heepen</div><h1>Nutzungsvereinbarung</h1></div>
          <div className="pd-ref">Buchung<br /><b>{b.number}</b></div>
        </header>

        <h2>1. Termin</h2>
        <table className="pd-table"><tbody>
          {row('Anlass', <b>{b.title}</b>)}
          {row('Art', cat?.name ?? b.categoryId)}
          {row('Beginn', `${fmtLong(b.start)}, ${berlinHm(b.start)} Uhr`)}
          {row('Ende', `${berlinYmd(b.end) !== berlinYmd(b.start) ? fmtDay(b.end) + ', ' : ''}${berlinHm(b.end)} Uhr`)}
          {row('Personen', `${b.guests} (zugelassen: höchstens ${s.capacity})`)}
          {b.equipment.length > 0 && row('Ausstattung', b.equipment.join(', '))}
        </tbody></table>

        <h2>2. Nutzer/in</h2>
        <table className="pd-table"><tbody>
          {row('Name', b.name)}
          {row(b.bookerType === 'member' ? 'Mannschaft / Abteilung' : 'Status', b.bookerType === 'member' ? (b.team || 'Mitglied') : 'nicht im Verein')}
          {row('Telefon', b.phone || '')}
          {row('E-Mail', b.silent && b.email.endsWith('@invalid') ? '' : b.email)}
          {row('Abgesprochen mit', b.agreedWith)}
        </tbody></table>

        {(b.rent > 0 || b.deposit > 0) && (<>
          <h2>3. Kosten</h2>
          <table className="pd-table"><tbody>
            {b.rent > 0 && row('Nutzungsentgelt', `${eur(b.rent)}  ☐ bezahlt am __________`)}
            {b.deposit > 0 && row('Kaution', `${eur(b.deposit)}  ☐ erhalten am __________   ☐ zurück am __________   einbehalten: ________ €`)}
          </tbody></table>
        </>)}

        <h2>{b.rent > 0 || b.deposit > 0 ? '4' : '3'}. Regeln</h2>
        <ul className="pd-list">{[...hausordnung(s.capacity), ...SCHLUESSELREGELN].map((h) => <li key={h}>{h}</li>)}</ul>

        <h2>{b.rent > 0 || b.deposit > 0 ? '5' : '4'}. Übergabe und Rückgabe</h2>
        <table className="pd-grid">
          <thead><tr><th /><th>Übergabe</th><th>Rückgabe</th></tr></thead>
          <tbody>
            <tr><th>Datum, Uhrzeit</th><td>{b.handoverAt ? `${fmtDay(b.handoverAt)}, ${berlinHm(b.handoverAt)}` : ''}</td><td>{b.returnAt ? `${fmtDay(b.returnAt)}, ${berlinHm(b.returnAt)}` : ''}</td></tr>
            <tr><th>Schlüssel (Anzahl)</th><td /><td /></tr>
            <tr><th>Stromzähler (kWh)</th><td>{b.meterStart ?? ''}</td><td>{b.meterEnd ?? ''}</td></tr>
            <tr><th>Zustand</th><td>☐ in Ordnung ☐ Mängel</td><td>☐ in Ordnung ☐ Mängel</td></tr>
            <tr className="tall"><th>Mängel / Bemerkungen</th><td /><td>{b.damageNote}</td></tr>
          </tbody>
        </table>

        <p className="pd-note">Mit der Unterschrift bestätigt die Nutzerin bzw. der Nutzer, die Regeln gelesen zu haben und für die Einhaltung während der Nutzung verantwortlich zu sein.</p>
        <div className="pd-sign">
          <div><span /><small>Ort, Datum, Unterschrift Nutzer/in</small></div>
          <div><span /><small>Unterschrift für den SV Heepen{op.name ? ` (${op.name})` : ''}</small></div>
        </div>
        <footer className="pd-foot">Jugendraum des SV Heepen · {b.number} · erstellt am {fmtDay(Date.now())}</footer>
      </article>
    </main>
  );
}
