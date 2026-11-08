import type { Booking } from '@/lib/data';
import type { Category } from '@/lib/rules';
import { eur } from '@/lib/labels';
import { berlinHm, berlinYmd, fmtDay, fmtLong } from '@/lib/time';

/** Die Eckdaten einer Buchung als Definitionsliste (Bucher-Seiten). */
export function BookingFacts({ b, cat }: { b: Booking; cat?: Category }) {
  return (
    <dl className="kv">
      <dt>Anlass</dt><dd><b>{b.title}</b></dd>
      <dt>Art</dt><dd>{cat ? <span className="catdot" style={{ '--c': cat.color } as React.CSSProperties}>{cat.name}</span> : b.categoryId}</dd>
      <dt>Termin</dt><dd>{fmtLong(b.start)}<br /><span className="num">{berlinHm(b.start)}–{berlinHm(b.end)} Uhr</span>{berlinYmd(b.end) !== berlinYmd(b.start) && <span className="muted"> (bis {fmtDay(b.end)})</span>}</dd>
      <dt>Personen</dt><dd className="num">{b.guests}</dd>
      {b.equipment.length > 0 && <><dt>Ausstattung</dt><dd>{b.equipment.join(', ')}</dd></>}
      <dt>Abgesprochen mit</dt><dd>{b.agreedWith}</dd>
      {(b.rent > 0 || b.deposit > 0) && <><dt>Kosten</dt><dd>{b.rent > 0 && <>Nutzungsentgelt {eur(b.rent)}</>}{b.rent > 0 && b.deposit > 0 && ' · '}{b.deposit > 0 && <>Kaution {eur(b.deposit)}</>}</dd></>}
    </dl>
  );
}
