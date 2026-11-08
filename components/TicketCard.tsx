import type { Booking } from '@/lib/data';
import type { Category } from '@/lib/rules';
import { berlinHm, fmtLong } from '@/lib/time';

export const STATUS_LABEL: Record<Booking['status'], string> = {
  pending_email: 'E-Mail offen', requested: 'Angefragt', confirmed: 'Bestätigt', rejected: 'Abgelehnt', cancelled: 'Storniert', expired: 'Verfallen',
};

export function TicketCard({ b, cat, heading, children }: { b: Booking; cat?: Category; heading: string; children?: React.ReactNode }) {
  return (
    <div className="ticket">
      <div className="top"><img src="/logo.png" alt="" /><div><b>{heading}</b><span className="mono" style={{ opacity: .85 }}>{b.number}</span></div></div>
      <div className="body">
        <span className={`stamp tilt s-${b.status}`}>{STATUS_LABEL[b.status]}</span>
        <dl className="kv">
          <dt>Anlass</dt><dd>{b.title}</dd>
          <dt>Wann</dt><dd>{fmtLong(b.start)}<br /><span className="mono">{berlinHm(b.start)}–{berlinHm(b.end)} Uhr</span></dd>
          <dt>Kategorie</dt><dd>{cat?.name ?? b.categoryId}</dd>
          <dt>Personen</dt><dd>{b.guests}</dd>
          <dt>Abgesprochen</dt><dd>{b.agreedWith}</dd>
          {b.rejectReason && <><dt>Begründung</dt><dd>{b.rejectReason}</dd></>}
        </dl>
      </div>
      {children && <><div className="perf" /><div className="body">{children}</div></>}
    </div>
  );
}
