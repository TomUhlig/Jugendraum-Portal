import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash } from '@/components/Flash';
import { STATUS_LABEL } from '@/components/TicketCard';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkExisting, getAudit, getBooking, getCategories } from '@/lib/data';
import { berlinHm, berlinYmd, fmtLong } from '@/lib/time';
import { decideAction, internalAction } from '../../../actions';

const fmtTs = (d: Date) => d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
const ACTION: Record<string, string> = {
  created: 'Anfrage gestellt', verified: 'E-Mail bestätigt', 'verified+auto-confirmed': 'E-Mail bestätigt, automatisch eingetragen',
  confirm: 'Bestätigt', reject: 'Abgelehnt', cancel: 'Storniert', 'cancelled-by-booker': 'Vom Bucher storniert', 'internal-update': 'Interne Angaben geändert', expired: 'Verfallen',
};

export default async function Detail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const { id } = await params; const sp = await searchParams;
  const b = await getBooking(id);
  if (!b) notFound();
  const [cats, check, audit, mailLog] = await Promise.all([
    getCategories(), checkExisting(b), getAudit(b.id),
    db()`select kind, recipient, subject, ok, created_at from mail_log where booking_id = ${b.id} order by created_at desc`,
  ]);
  const c = cats.find((x) => x.id === b.categoryId);
  const can = me.role !== 'viewer';
  const active = ['requested', 'confirmed', 'pending_email'].includes(b.status);
  const hidden = (action: string) => <><input type="hidden" name="id" value={b.id} /><input type="hidden" name="action" value={action} /><input type="hidden" name="back" value={`/admin/buchung/${b.id}`} /></>;

  return (
    <div className="wrap" style={{ paddingBottom: 40 }}>
      <div className="page-title">
        <div><span className="label mono">{b.number}</span><h1>{b.title}</h1></div>
        <span className={`stamp tilt s-${b.status}`}>{STATUS_LABEL[b.status]}</span>
      </div>
      <Flash sp={sp} />
      <div className="cols">
        <div className="stack">
          <section className="panel">
            <span className="ribbon">Termin</span>
            <dl className="kv">
              <dt>Wann</dt><dd>{fmtLong(b.start)}<br /><span className="mono">{berlinHm(b.start)}–{berlinHm(b.end)} Uhr</span>{berlinYmd(b.end) !== berlinYmd(b.start) ? ' (bis zum Folgetag)' : ''}</dd>
              <dt>Kategorie</dt><dd><span className="catchip" style={{ '--c': c?.color } as React.CSSProperties}><i />{c?.name}</span>{c && <span className="muted"> · Puffer {c.bufferBefore}/{c.bufferAfter} min</span>}</dd>
              <dt>Personen</dt><dd>{b.guests}</dd>
              <dt>Notiz</dt><dd style={{ whiteSpace: 'pre-wrap', fontWeight: 400 }}>{b.note || '–'}</dd>
              <dt>Regelprüfung</dt><dd><span className={`flag st-${check.level}`}>{check.level === 'ok' ? '✓ Keine Konflikte' : check.messages.map((m) => m.text).join(' ')}</span></dd>
            </dl>
          </section>
          {can && active && (
            <section className="panel stack">
              <span className="ribbon" style={{ justifySelf: 'start' }}>Entscheidung</span>
              {b.status === 'pending_email' && <p className="muted" style={{ margin: 0 }}>Der Bucher hat seine E-Mail noch nicht bestätigt. Ohne Bestätigung verfällt die Anfrage nach 24 Stunden.</p>}
              {b.status === 'requested' && (
                <form action={decideAction}>{hidden('confirm')}<button className="btn ok" type="submit">Bestätigen und Mail senden</button></form>
              )}
              <form action={decideAction} className="stack">
                {hidden(b.status === 'confirmed' ? 'cancel' : 'reject')}
                <div className="field"><label htmlFor="reason">{b.status === 'confirmed' ? 'Stornieren, weil …' : 'Ablehnen, weil …'}</label>
                  <textarea id="reason" name="reason" required minLength={3} placeholder="z. B. An dem Wochenende findet das Vereinsfest statt." /><small>Die Begründung steht in der Mail an {b.name}.</small></div>
                <button className="btn no" type="submit" style={{ justifySelf: 'start' }}>{b.status === 'confirmed' ? 'Buchung stornieren' : 'Anfrage ablehnen'}</button>
              </form>
            </section>
          )}
          <section className="panel">
            <span className="ribbon">Verlauf</span>
            <div className="table-wrap"><table><tbody>
              {audit.map((a) => <tr key={a.id}><td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtTs(a.created_at)}</td><td>{ACTION[a.action] ?? a.action}{a.detail?.reason ? ` – „${a.detail.reason}“` : ''}</td><td className="muted">{a.actor}</td></tr>)}
              {mailLog.map((m, i) => <tr key={'m' + i}><td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtTs(m.created_at)}</td><td>✉️ {m.subject}{m.ok ? '' : ' (Fehler beim Versand)'}</td><td className="muted">{m.recipient}</td></tr>)}
            </tbody></table></div>
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <span className="ribbon">Kontakt</span>
            <dl className="kv">
              <dt>Name</dt><dd>{b.name}</dd>
              <dt>Typ</dt><dd>{b.bookerType === 'member' ? `Mitglied${b.team ? ' · ' + b.team : ''}` : 'Extern'}</dd>
              <dt>E-Mail</dt><dd><a href={`mailto:${b.email}`}>{b.email}</a></dd>
              <dt>Telefon</dt><dd><a href={`tel:${b.phone.replace(/\s/g, '')}`}>{b.phone}</a></dd>
              <dt>Abgesprochen</dt><dd>{b.agreedWith}</dd>
              {b.decidedBy && <><dt>Entschieden</dt><dd>{b.decidedBy}</dd></>}
            </dl>
          </section>
          <section className="panel">
            <span className="ribbon">Intern</span>
            <form action={internalAction} className="stack">
              <input type="hidden" name="id" value={b.id} />
              <label className="toggle"><input type="checkbox" name="keyHandedOut" defaultChecked={b.keyHandedOut} disabled={!can} /><span>Schlüssel ausgegeben</span></label>
              <label className="toggle"><input type="checkbox" name="depositPaid" defaultChecked={b.depositPaid} disabled={!can} /><span>Kaution / Miete erhalten</span></label>
              <div className="field"><label htmlFor="internalNote">Interne Notiz</label><textarea id="internalNote" name="internalNote" defaultValue={b.internalNote} disabled={!can} placeholder="Nur für das Orga-Team sichtbar" /></div>
              {can && <button className="btn primary" type="submit" style={{ justifySelf: 'start' }}>Speichern</button>}
            </form>
          </section>
          <Link href="/admin" className="btn" style={{ justifySelf: 'start' }}>← Zur Übersicht</Link>
        </div>
      </div>
    </div>
  );
}
