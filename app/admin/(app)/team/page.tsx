import { Flash } from '@/components/Flash';
import { feedToken, requireAdmin } from '@/lib/auth';
import { listAdmins } from '@/lib/data';
import { appUrl } from '@/lib/url';
import { removeAdminAction, upsertAdminAction } from '../../actions';

const ROLE = { admin: 'Admin (alles)', manager: 'Verwalter (Anfragen, Kalender)', viewer: 'Lesezugriff' };

export default async function Team({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const admins = await listAdmins();
  const feed = `${appUrl()}/api/ical/${feedToken(me.id)}`;
  const isAdmin = me.role === 'admin';
  return (
    <div className="wrap stack" style={{ paddingBottom: 40 }}>
      <div className="page-title"><div><span className="label">Verwaltung</span><h1>Team</h1></div></div>
      <Flash sp={sp} />
      <section className="panel stack">
        <span className="ribbon" style={{ justifySelf: 'start' }}>Dein Kalender-Abo</span>
        <p style={{ margin: 0 }}>Mit diesem Link erscheinen alle Buchungen automatisch in deinem Handy- oder Outlook-Kalender. In Google Kalender: „Weitere Kalender → Per URL“. Auf dem iPhone: Einstellungen → Kalender → Accounts → Kalenderabo hinzufügen.</p>
        <input type="text" readOnly value={feed} aria-label="Kalender-Abo-Link" className="mono" style={{ fontSize: '.85rem' }} />
        <small className="muted">Der Link ist persönlich und geheim. Er zeigt Namen und Telefonnummern, bitte nicht weitergeben.</small>
      </section>
      <section className="panel">
        <span className="ribbon">Orga-Team</span>
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Mails bei Anfragen</th><th /></tr></thead><tbody>
          {admins.map((a) => (
            <tr key={a.id}><td>{a.name}{a.id === me.id && <span className="muted"> (du)</span>}</td><td>{a.email}</td><td>{ROLE[a.role]}</td><td>{a.notify && a.role !== 'viewer' ? 'ja' : '–'}</td>
              <td>{isAdmin && a.id !== me.id && <form action={removeAdminAction}><input type="hidden" name="id" value={a.id} /><button className="btn small no" type="submit">Entfernen</button></form>}</td></tr>
          ))}
        </tbody></table></div>
      </section>
      {isAdmin && (
        <section className="panel">
          <span className="ribbon">Person hinzufügen oder ändern</span>
          <form action={upsertAdminAction} className="stack">
            <div className="row">
              <div className="field"><label htmlFor="t-name">Name</label><input type="text" id="t-name" name="name" required placeholder="Sigrid Brodig" /></div>
              <div className="field"><label htmlFor="t-email">E-Mail</label><input type="email" id="t-email" name="email" required /></div>
              <div className="field"><label htmlFor="t-role">Rolle</label><select id="t-role" name="role" defaultValue="manager">{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            </div>
            <label className="toggle"><input type="checkbox" name="notify" defaultChecked /><span>Bekommt Mails bei neuen Anfragen und Stornos</span></label>
            <button className="btn primary" type="submit" style={{ justifySelf: 'start' }}>Speichern</button>
            <small className="muted">Gibt es die E-Mail-Adresse schon, werden Name, Rolle und Benachrichtigung aktualisiert.</small>
          </form>
        </section>
      )}
    </div>
  );
}
