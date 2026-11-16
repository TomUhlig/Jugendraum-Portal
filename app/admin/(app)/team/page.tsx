import { Flash, PageHead } from '@/components/Flash';
import { feedToken, requireAdmin, shareFeedToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { CopyText } from '@/components/CopyText';
import { listAdmins } from '@/lib/data';
import { initials } from '@/lib/labels';
import { appUrl } from '@/lib/url';
import { PushToggle } from '@/components/PushToggle';
import { countSubscriptions, vapidKeys } from '@/lib/push';
import { removeAdminAction, upsertAdminAction } from '../../actions';

export const metadata = { title: 'Team' };

const ROLE = { admin: 'Admin', manager: 'Verwalter', viewer: 'Lesezugriff' };
const ROLE_HINT = { admin: 'alles, inkl. Einstellungen und Team', manager: 'Anfragen entscheiden, Termine pflegen', viewer: 'nur ansehen' };

export default async function Team({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const [admins, keys, devices] = await Promise.all([listAdmins(), vapidKeys(), countSubscriptions(me.id)]);
  const feed = `${appUrl()}/api/ical/${feedToken(me.id)}`;
  const isAdmin = me.role === 'admin';
  const teams = (await db()`select team from bookings where team <> '' and status = 'confirmed' and starts_at > now() - interval '12 months' group by team order by count(*) desc limit 12`).map((r) => r.team as string);
  const gcal = (url: string) => `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(url.replace(/^https?:/, 'webcal:'))}`;
  return (
    <>
      <PageHead title="Team" />
      <Flash sp={sp} />
      <section className="card">
        <div className="card-head"><div><h2>Push-Benachrichtigungen</h2><p>Bei neuer Anfrage, Absage, Nachricht oder Schadensmeldung meldet sich dein Handy. {devices > 0 ? `Aktiv auf ${devices} ${devices === 1 ? 'Gerät' : 'Geräten'}.` : ''}</p></div></div>
        <div className="card-body"><PushToggle publicKey={keys.publicKey} /></div>
        {!me.notify && <div className="card-foot small muted">Hinweis: Für dich sind Benachrichtigungen im Team ausgeschaltet. Ein Admin kann das unten bei deinem Eintrag ändern.</div>}
      </section>
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
        <div className="card-head"><div><h2>Dein Kalender-Abo</h2><p>Buchungen automatisch im eigenen Kalender, stündlich aktualisiert. Enthält Namen und Telefonnummern, nur für dich.</p></div></div>
        <ul className="list feed-list">
          {[['Alle Termine und Anfragen', ''], ['Nur bestätigte Termine', '?nur=bestaetigt'], ['Nur Feiern', '?nur=feiern']].map(([label, q]) => (
            <li key={label} className="feed-row"><div><b>{label}</b><CopyText text={feed + q} /></div><a className="btn btn-sm" href={gcal(feed + q)} target="_blank" rel="noreferrer">In Google Kalender</a></li>
          ))}
        </ul>
        <div className="card-foot muted small">Google Kalender: Knopf rechts oder „Weitere Kalender → Per URL“. iPhone: Einstellungen → Kalender → Accounts → Kalenderabo hinzufügen. Outlook: Kalender hinzufügen → Aus dem Internet abonnieren.</div>
      </section>

      <section className="card">
        <div className="card-head"><div><h2>Kalender zum Weitergeben</h2><p>Ohne Namen und Telefonnummern, z. B. für die WhatsApp-Gruppe einer Mannschaft oder den Vorstand. Nur bestätigte Termine.</p></div></div>
        <ul className="list feed-list">
          {[{ label: 'Belegung allgemein', hint: 'nur „Jugendraum belegt“', f: { k: 'all' as const } }, { label: 'Alle Feiern', hint: 'Anlass und Mannschaft', f: { k: 'parties' as const } },
            ...teams.map((tm) => ({ label: tm, hint: 'Termine dieser Mannschaft', f: { k: 'team' as const, v: tm } }))].map((x) => {
            const url = `${appUrl()}/api/ical/abo/${shareFeedToken(x.f)}.ics`;
            return <li key={x.label} className="feed-row"><div><b>{x.label}</b> <span className="muted small">{x.hint}</span><CopyText text={url} /></div><a className="btn btn-sm" href={gcal(url)} target="_blank" rel="noreferrer">In Google Kalender</a></li>;
          })}
        </ul>
      </section>
    </>
  );
}
