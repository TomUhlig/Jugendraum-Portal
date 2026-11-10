import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { emailFromBookerToken } from '@/lib/auth';
import { getCategories, listByEmail } from '@/lib/data';
import { berlinHm, fmtDay } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meine Buchungen', robots: { index: false } };

export default async function Liste({ params }: { params: Promise<{ token: string }> }) {
  const email = emailFromBookerToken((await params).token);
  if (!email) {
    return (
      <main className="wrap" style={{ paddingBlock: 40, maxWidth: 520 }}>
        <section className="card card-body stack"><h1 style={{ fontSize: '1.4rem' }}>Link abgelaufen</h1>
          <p className="muted">Der Link ist nicht mehr gültig. Fordere einfach einen neuen an.</p>
          <Link className="btn btn-primary" href="/meine-buchungen" style={{ justifySelf: 'start' }}>Neuen Link anfordern</Link></section>
      </main>
    );
  }
  const [list, cats] = await Promise.all([listByEmail(email), getCategories()]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const now = Date.now();
  const upcoming = list.filter((b) => b.end >= now).reverse(), past = list.filter((b) => b.end < now);
  const Section = ({ title, items }: { title: string; items: typeof list }) => (
    <section className="card">
      <div className="card-head"><h2>{title}</h2><span className="muted small">{items.length}</span></div>
      {items.length === 0 ? <div className="empty">Keine Buchungen.</div> : (
        <ul className="list">{items.map((b) => (
          <li key={b.id} className="between">
            <div style={{ minWidth: 0 }}>
              <Link href={`/buchung/${b.manageToken}`} className="catdot" style={{ '--c': cat.get(b.categoryId)?.color, color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' } as React.CSSProperties}>{b.title}</Link>
              <div className="muted small num">{fmtDay(b.start)}, {berlinHm(b.start)}–{berlinHm(b.end)} Uhr · {b.number}</div>
            </div>
            <StatusBadge status={b.status} />
          </li>
        ))}</ul>
      )}
    </section>
  );
  return (
    <main className="wrap narrow" style={{ paddingBlock: 32 }}>
      <div className="stack">
        <div><span className="eyebrow">{email}</span><h1 style={{ fontSize: '1.6rem' }}>Meine Buchungen</h1></div>
        <Section title="Anstehend" items={upcoming} />
        {past.length > 0 && <Section title="Vergangen (letzte 12 Monate)" items={past} />}
        <Link className="btn btn-primary" href="/" style={{ justifySelf: 'start' }}>Neuen Termin anfragen</Link>
      </div>
    </main>
  );
}
