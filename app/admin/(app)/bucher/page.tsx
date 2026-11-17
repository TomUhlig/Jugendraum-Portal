import Link from 'next/link';
import { Search } from 'lucide-react';
import { Flash, PageHead } from '@/components/Flash';
import { requireAdmin } from '@/lib/auth';
import { bookerKey, listBookers } from '@/lib/data';
import { fmtDay } from '@/lib/time';
import { initials } from '@/lib/labels';

export const metadata = { title: 'Bucher' };

export default async function Bucher({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const list = await listBookers(sp.q?.slice(0, 60) ?? '');
  const filtered = sp.tag ? list.filter((b) => b.tags.includes(sp.tag)) : list;
  const tags = [...new Set(list.flatMap((b) => b.tags))];
  return (
    <>
      <PageHead eyebrow="Wer bucht den Raum? Personen mit Buchungen der letzten 12 Monate" title="Bucher" />
      <Flash sp={sp} />
      <form className="card card-body filters" method="get" data-autosubmit>
        <div className="field grow"><label htmlFor="bq">Suche</label><input id="bq" name="q" type="search" defaultValue={sp.q} placeholder="Name, Mannschaft, E-Mail" /></div>
        <button className="btn no-js-only" type="submit"><Search className="icon-sm" />Suchen</button>
      </form>
      {tags.length > 0 && <nav className="status-chips"><Link href="/admin/bucher" aria-current={!sp.tag ? 'page' : undefined}>Alle <b>{list.length}</b></Link>
        {tags.map((t) => <Link key={t} href={`/admin/bucher?tag=${encodeURIComponent(t)}`} aria-current={sp.tag === t ? 'page' : undefined}>{t} <b>{list.filter((b) => b.tags.includes(t)).length}</b></Link>)}</nav>}
      <section className="card">
        <div className="card-head"><h2>{filtered.length} Bucher</h2></div>
        {filtered.length === 0 ? <div className="empty">Niemand gefunden.</div> : (
          <ul className="list booker-list">{filtered.map((b) => (
            <li key={b.email}>
              <Link href={`/admin/bucher/${bookerKey(b.email)}`} className="booker-row">
                <span className="avatar">{initials(b.name)}</span>
                <span className="bk-main"><b>{b.name}</b><span className="muted small">{b.team || (b.external ? 'nicht im Verein' : 'Mitglied')} · {b.email}</span>
                  {b.tags.length > 0 && <span className="bk-tags">{b.tags.map((t) => <span key={t} className={`badge no-dot tag-${t.replace(/\W+/g, '')}`}>{t}</span>)}</span>}</span>
                <span className="bk-stats"><b className="num">{b.confirmed}</b><span className="muted small">{b.confirmed === 1 ? 'Termin' : 'Termine'}{b.cancelled ? ` · ${b.cancelled} abgesagt` : ''}</span></span>
                <span className="bk-dates muted small">{b.next ? <>nächster: <b>{fmtDay(b.next)}</b></> : b.last ? <>zuletzt: {fmtDay(b.last)}</> : '–'}</span>
              </Link>
            </li>
          ))}</ul>
        )}
      </section>
    </>
  );
}
