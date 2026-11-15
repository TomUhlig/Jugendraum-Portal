import type { Booking } from '@/lib/data';
import type { Category } from '@/lib/rules';
import { LOCALE, catLabel, t, type Lang } from '@/lib/i18n';
import { berlinHm, berlinYmd, fmtDay, fmtLong } from '@/lib/time';

/** Die Eckdaten einer Buchung als Definitionsliste (Bucher-Seiten). */
export function BookingFacts({ b, cat, lang = 'de' }: { b: Booking; cat?: Category; lang?: Lang }) {
  const F = t(lang).booker.facts;
  const eur = (n: number) => n.toLocaleString(LOCALE[lang], { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 });
  return (
    <dl className="kv">
      <dt>{F.occasion}</dt><dd><b>{b.title}</b></dd>
      <dt>{F.kind}</dt><dd>{cat ? <span className="catdot" style={{ '--c': cat.color } as React.CSSProperties}>{catLabel(lang, cat).name}</span> : b.categoryId}</dd>
      <dt>{F.appointment}</dt><dd>{fmtLong(b.start, lang)}<br /><span className="num">{berlinHm(b.start)}–{berlinHm(b.end)}{lang === 'de' ? ' Uhr' : ''}</span>{berlinYmd(b.end) !== berlinYmd(b.start) && <span className="muted"> ({t(lang).app.until} {fmtDay(b.end, lang)})</span>}</dd>
      <dt>{F.people}</dt><dd className="num">{b.guests}</dd>
      {b.equipment.length > 0 && <><dt>{F.equipment}</dt><dd>{b.equipment.join(', ')}</dd></>}
      <dt>{F.agreed}</dt><dd>{b.agreedWith}</dd>
      {(b.rent > 0 || b.deposit > 0) && <><dt>{F.costs}</dt><dd>{b.rent > 0 && <>{F.rent} {eur(b.rent)}</>}{b.rent > 0 && b.deposit > 0 && ' · '}{b.deposit > 0 && <>{F.deposit} {eur(b.deposit)}</>}</dd></>}
    </dl>
  );
}
