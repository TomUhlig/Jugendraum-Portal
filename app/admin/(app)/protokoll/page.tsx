import Link from 'next/link';
import { PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAudit } from '@/lib/data';

const fmtTs = (d: Date) => d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
const ACTION: Record<string, string> = {
  created: 'Anfrage gestellt', verified: 'E-Mail bestätigt', 'verified+auto-confirmed': 'automatisch eingetragen', 'admin-created': 'eingetragen', confirm: 'bestätigt',
  reject: 'abgelehnt', cancel: 'storniert', 'cancelled-by-booker': 'vom Bucher abgesagt', 'internal-note': 'Notiz geändert', handover: 'Übergabeprotokoll',
  money: 'Kosten geändert', changed: 'Termin geändert', expired: 'verfallen', feedback: 'Rückmeldung', settings: 'Einstellungen geändert',
  'blackout-added': 'Sperrzeit eingetragen', 'blackout-removed': 'Sperrzeit gelöscht',
};

export default async function Protokoll({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const tab = (await searchParams).tab === 'mails' ? 'mails' : 'aenderungen';
  const [audit, mails] = await Promise.all([
    tab === 'aenderungen' ? getAudit(undefined, 200) : Promise.resolve([]),
    tab === 'mails' ? db()`select kind, recipient, subject, ok, error, created_at, booking_id from mail_log order by created_at desc limit 200` : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHead title="Protokoll">
        <div className="segmented"><Link href="?tab=aenderungen" aria-current={tab === 'aenderungen' ? 'page' : undefined}>Änderungen</Link><Link href="?tab=mails" aria-current={tab === 'mails' ? 'page' : undefined}>E-Mails</Link></div>
      </PageHead>
      <section className="card">
        <div className="table-wrap"><table>
          {tab === 'aenderungen' ? <>
            <thead><tr><th>Zeitpunkt</th><th>Wer</th><th>Was</th><th>Buchung</th></tr></thead>
            <tbody>{audit.map((a) => <tr key={a.id}><td className="num muted" style={{ whiteSpace: 'nowrap' }}>{fmtTs(a.created_at)}</td><td>{a.actor}</td><td>{ACTION[a.action] ?? a.action}{a.detail?.reason ? <span className="muted"> „{a.detail.reason}“</span> : null}</td>
              <td>{a.booking_id ? <Link href={`/admin/buchung/${a.booking_id}`}>{a.title}</Link> : '–'}</td></tr>)}</tbody>
          </> : <>
            <thead><tr><th>Zeitpunkt</th><th>An</th><th>Betreff</th><th>Status</th></tr></thead>
            <tbody>{mails.map((m, i) => <tr key={i}><td className="num muted" style={{ whiteSpace: 'nowrap' }}>{fmtTs(m.created_at)}</td><td>{m.recipient}</td>
              <td>{m.booking_id ? <Link href={`/admin/buchung/${m.booking_id}`}>{m.subject}</Link> : m.subject}</td>
              <td>{m.ok ? <span className="badge b-ok">zugestellt</span> : <span className="badge b-bad" title={m.error}>Fehler</span>}</td></tr>)}</tbody>
          </>}
        </table></div>
      </section>
    </>
  );
}
