import { Flash, PageHead } from '@/components/Flash';
import { feedToken, requireAdmin } from '@/lib/auth';
import { listAdmins } from '@/lib/data';
import { initials } from '@/lib/labels';
import { appUrl } from '@/lib/url';
import { removeAdminAction, upsertAdminAction } from '../../actions';

const ROLE = { admin: 'Admin', manager: 'Verwalter', viewer: 'Lesezugriff' };
const ROLE_HINT = { admin: 'alles, inkl. Einstellungen und Team', manager: 'Anfragen entscheiden, Termine pflegen', viewer: 'nur ansehen' };

export default async function Team({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const admins = await listAdmins();
  const feed = `${appUrl()}/api/ical/${feedToken(me.id)}`;
  const isAdmin = me.role === 'admin';
  return (
    <>
      <PageHead title="Team" />
      <Flash sp={sp} />
      <section className="card">
        <div className="card-head"><h2>Orga-Team</h2><span className="muted small">{admins.length} Personen</span></div>
        <ul className="list">{admins.map((a) => (
          <li key={a.id} className="between">
            <div className="contact"><span className="avatar">{initials(a.name)}</span><div><b>{a.name}</b>{a.id === me.id && <span className="muted"> (du)</span>}<br /><span className="muted small">{a.email}</span></div></div>
            <div className="inline">
              <span className="badge b-info no-dot" title={ROLE_HINT[a.role]}>{ROLE[a.role]}</span>
              {a.notify && a.role !== 'viewer' && <span className="badge no-dot">bekommt Mails</span>}
              {isAdmin && a.id !== me.id && <form action={removeAdminAction}><input type="hidden" name="id" value={a.id} /><button className="btn btn-sm btn-ghost" type="submit">Entfernen</button></form>}
            </div>
          </li>
        ))}</ul>
      </section>
      {isAdmin && (
        <form action={upsertAdminAction} className="card">
          <div className="card-head"><div><h2>Person hinzufügen oder ändern</h2><p>Die Anmeldung läuft per E-Mail-Link, ein Passwort ist nicht nötig.</p></div></div>
          <div className="card-body stack">
            <div className="row">
              <div className="field"><label htmlFor="t-name">Name</label><input type="text" id="t-name" name="name" required /></div>
              <div className="field"><label htmlFor="t-email">E-Mail</label><input type="email" id="t-email" name="email" required /></div>
              <div className="field"><label htmlFor="t-role">Rolle</label><select id="t-role" name="role" defaultValue="manager">{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}: {ROLE_HINT[k as keyof typeof ROLE_HINT]}</option>)}</select></div>
            </div>
            <label className="check-inline"><input type="checkbox" name="notify" defaultChecked /> Bekommt Mails bei neuen Anfragen, Absagen und Schadensmeldungen</label>
          </div>
          <div className="card-foot"><button className="btn btn-primary" type="submit">Speichern</button> <span className="muted small" style={{ marginLeft: 8 }}>Bei bekannter E-Mail-Adresse werden Name und Rolle aktualisiert.</span></div>
        </form>
      )}
      <section className="card">
        <div className="card-head"><div><h2>Dein Kalender-Abo</h2><p>Alle Buchungen automatisch im eigenen Kalender, stündlich aktualisiert</p></div></div>
        <div className="card-body stack-sm">
          <input type="text" readOnly value={feed} aria-label="Kalender-Abo-Link" className="small" />
          <span className="muted small">Google Kalender: Weitere Kalender → Per URL. iPhone: Einstellungen → Kalender → Accounts → Kalenderabo hinzufügen. Outlook: Kalender hinzufügen → Aus dem Internet abonnieren.</span>
          <span className="muted small">Der Link ist persönlich und enthält Namen und Telefonnummern. Bitte nicht weitergeben.</span>
        </div>
      </section>
    </>
  );
}
