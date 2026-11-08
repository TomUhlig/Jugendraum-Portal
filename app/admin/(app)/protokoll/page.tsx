import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAudit } from '@/lib/data';

const fmtTs = (d: Date) => d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });

export default async function Protokoll() {
  await requireAdmin();
  const [audit, mails] = await Promise.all([
    getAudit(undefined, 100),
    db()`select kind, recipient, subject, ok, error, created_at from mail_log order by created_at desc limit 100`,
  ]);
  return (
    <div className="wrap stack" style={{ paddingBottom: 40 }}>
      <div className="page-title"><div><span className="label">Verwaltung</span><h1>Protokoll</h1></div></div>
      <section className="panel">
        <span className="ribbon">Änderungen</span>
        <div className="table-wrap"><table><thead><tr><th>Wann</th><th>Wer</th><th>Was</th><th>Buchung</th></tr></thead><tbody>
          {audit.map((a) => <tr key={a.id}><td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtTs(a.created_at)}</td><td>{a.actor}</td><td>{a.action}{a.detail?.reason ? ` – „${a.detail.reason}“` : ''}</td>
            <td>{a.booking_id ? <Link href={`/admin/buchung/${a.booking_id}`}>{a.number} {a.title}</Link> : '–'}</td></tr>)}
        </tbody></table></div>
      </section>
      <section className="panel">
        <span className="ribbon">Verschickte Mails</span>
        <div className="table-wrap"><table><thead><tr><th>Wann</th><th>An</th><th>Betreff</th><th>Status</th></tr></thead><tbody>
          {mails.map((m, i) => <tr key={i}><td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtTs(m.created_at)}</td><td>{m.recipient}</td><td>{m.subject}</td><td>{m.ok ? 'verschickt' : <span className="err" title={m.error}>Fehler</span>}</td></tr>)}
        </tbody></table></div>
      </section>
    </div>
  );
}
