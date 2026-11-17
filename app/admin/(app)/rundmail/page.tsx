import { Send } from 'lucide-react';
import { Flash, PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { PROFILE_TAGS, rundmailRecipients, type RundmailFilter } from '@/lib/data';
import { addDays, berlinToUtc, berlinYmd } from '@/lib/time';
import { rundmailAction } from '../../actions';

export const metadata = { title: 'Rundmail' };

/** Rundmail an Bucher, z. B. „Ab 1. März wird renoviert“. Erst Vorschau der Empfänger, dann senden. */
export default async function Rundmail({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin('manager');
  const sp = await searchParams;
  const today = berlinYmd(Date.now());
  const group = (['period', 'recent', 'tag', 'team'].includes(sp.gruppe) ? sp.gruppe : 'period') as RundmailFilter['group'];
  const von = /^\d{4}-\d\d-\d\d$/.test(sp.von ?? '') ? sp.von : today, bis = /^\d{4}-\d\d-\d\d$/.test(sp.bis ?? '') ? sp.bis : addDays(today, 30);
  const f: RundmailFilter = { group, from: berlinToUtc(von, '00:00'), to: berlinToUtc(addDays(bis, 1), '00:00'), tag: sp.merkmal, team: sp.team, includeSilent: sp.stumm === '1' };
  const [list, teamsRows] = await Promise.all([rundmailRecipients(f), db()`select distinct team from bookings where team <> '' and starts_at > now() - interval '12 months' order by team`]);
  const teams = teamsRows.map((r) => r.team as string);
  return (
    <>
      <PageHead eyebrow="Eine Nachricht an viele Bucher, jede Person bekommt eine eigene Mail" title="Rundmail" />
      <Flash sp={sp} />
      <form method="get" className="card card-body filters" data-autosubmit>
        <div className="field"><label htmlFor="g">Empfänger</label><select id="g" name="gruppe" defaultValue={group}>
          <option value="period">Mit Terminen im Zeitraum</option><option value="recent">Alle Bucher der letzten 12 Monate</option>
          <option value="tag">Nach Merkmal im Profil</option><option value="team">Eine Mannschaft</option></select></div>
        {group === 'period' && <><div className="field"><label htmlFor="v">von</label><input id="v" type="date" name="von" defaultValue={von} /></div><div className="field"><label htmlFor="b">bis</label><input id="b" type="date" name="bis" defaultValue={bis} /></div></>}
        {group === 'tag' && <div className="field"><label htmlFor="m">Merkmal</label><select id="m" name="merkmal" defaultValue={sp.merkmal ?? PROFILE_TAGS[0]}>{PROFILE_TAGS.map((t) => <option key={t}>{t}</option>)}</select></div>}
        {group === 'team' && <div className="field"><label htmlFor="t">Mannschaft</label><select id="t" name="team" defaultValue={sp.team ?? teams[0]}>{teams.map((t) => <option key={t}>{t}</option>)}</select></div>}
        <label className="check-inline small"><input type="checkbox" name="stumm" value="1" defaultChecked={sp.stumm === '1'} /> auch Buchungen „ohne E-Mails“</label>
      </form>
      <div className="grid-2b">
        <form action={rundmailAction} className="card">
          {Object.entries({ gruppe: group, von, bis, merkmal: sp.merkmal ?? '', team: sp.team ?? '', stumm: sp.stumm ?? '' }).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="card-head"><h2>Nachricht</h2></div>
          <div className="card-body stack-sm">
            <div className="field"><label htmlFor="rs" className="req">Betreff</label><input id="rs" name="subject" required maxLength={120} placeholder="z. B. Jugendraum vom 1. bis 14. März geschlossen" /></div>
            <div className="field"><label htmlFor="rt" className="req">Text</label><textarea id="rt" name="text" required minLength={10} maxLength={4000} rows={8} placeholder={'Die Anrede („Hallo …,“) setzt das Portal selbst ein.\n\nAbsätze mit einer Leerzeile trennen.'} /></div>
            <label className="check-inline small"><input type="checkbox" name="sure" required /> Ich habe die Empfängerliste geprüft ({list.length})</label>
          </div>
          <div className="card-foot"><button className="btn btn-primary" type="submit" disabled={!list.length}><Send className="icon-sm" />An {list.length} {list.length === 1 ? 'Person' : 'Personen'} senden</button></div>
        </form>
        <section className="card">
          <div className="card-head"><h2>Empfänger</h2><span className="badge no-dot">{list.length}</span></div>
          {list.length === 0 ? <div className="empty">Niemand für diese Auswahl.</div> : <ul className="list" style={{ maxHeight: 420, overflow: 'auto' }}>{list.map((r) => <li key={r.email} className="between"><span>{r.name}</span><span className="muted small">{r.email}{r.lang !== 'de' ? ` · ${r.lang.toUpperCase()}` : ''}</span></li>)}</ul>}
        </section>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>Höchstens 300 Empfänger je Rundmail. Bitte nur für Infos rund um den Raum nutzen, nicht für Werbung. Absender: {me.name}.</p>
    </>
  );
}
