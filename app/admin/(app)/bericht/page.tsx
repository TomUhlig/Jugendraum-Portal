import { Download } from 'lucide-react';
import Link from 'next/link';
import { PageHead } from '@/components/Flash';
import { PrintButton } from '@/components/PrintButton';
import { requireAdmin } from '@/lib/auth';
import { getCategories, getExtras, getYearReport } from '@/lib/data';
import { eur } from '@/lib/labels';

export const metadata = { title: 'Jahresübersicht' };

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export default async function Bericht({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const now = new Date().getFullYear();
  const year = /^\d{4}$/.test(sp.jahr ?? '') ? +sp.jahr : now;
  const [r, cats, x] = await Promise.all([getYearReport(year), getCategories(), getExtras()]);
  const t = r.totals, m = r.money;
  const catN = new Map(r.byCat.map((c) => [c.category_id as string, c]));
  const months = MONTHS.map((name, i) => { const b = r.byMonth.find((x) => x.m === i + 1); return { name, n: (b?.n as number) ?? 0, hours: (b?.hours as number) ?? 0, rent: (b?.rent as number) ?? 0 }; });
  const income = m.rent_paid + m.deposit_kept;
  return (
    <div className="report">
      <PageHead eyebrow="Für Vorstand, Kassenprüfung und Jahreshauptversammlung" title={`Jahresübersicht ${year}`}>
        <a className="btn" href={`/rueckblick/${year}`} target="_blank" rel="noreferrer">Rückblick zum Teilen</a>
        <div className="segmented no-print">{[now - 2, now - 1, now].map((y) => <Link key={y} href={`?jahr=${y}`} aria-current={y === year ? 'page' : undefined}>{y}</Link>)}</div>
        <a className="btn no-print" href={`/admin/bericht/export?jahr=${year}`}><Download className="icon-sm" />Excel-Liste</a>
        <span className="no-print"><PrintButton /></span>
      </PageHead>
      <div className="print-only report-head">Jugendraum des SV Heepen · Jahresübersicht {year}{x.operator.name ? ` · ${x.operator.name}` : ''} · erstellt am {new Date().toLocaleDateString('de-DE')}</div>

      <div className="kpis">
        <div className="card kpi"><span className="k">Bestätigte Termine</span><span className="v">{t.n}</span><span className="s">{t.hours} Stunden Nutzung</span></div>
        <div className="card kpi"><span className="k">Feiern</span><span className="v">{t.parties}</span><span className="s">{t.external} von Externen</span></div>
        <div className="card kpi"><span className="k">Mannschaften & Abteilungen</span><span className="v">{t.teams}</span><span className="s">{t.member} Termine von Mitgliedern</span></div>
        <div className="card kpi"><span className="k">Einnahmen</span><span className="v">{eur(income)}</span><span className="s">Entgelte + einbehaltene Kautionen</span></div>
      </div>

      <div className="grid-2b">
        <section className="card">
          <div className="card-head"><h2>Finanzen</h2></div>
          <div className="table-wrap"><table><tbody>
            <tr><td>Nutzungsentgelte eingenommen</td><td className="num" style={{ textAlign: 'right' }}><b>{eur(m.rent_paid)}</b></td></tr>
            <tr><td>Nutzungsentgelte noch offen</td><td className="num" style={{ textAlign: 'right' }}>{eur(m.rent_open)}</td></tr>
            <tr><td>Kautionen erhalten</td><td className="num" style={{ textAlign: 'right' }}>{eur(m.deposit_in)}</td></tr>
            <tr><td>Kautionen zurückgezahlt</td><td className="num" style={{ textAlign: 'right' }}>{eur(m.deposit_back)}</td></tr>
            <tr><td>Kautionen einbehalten (Schäden, Reinigung)</td><td className="num" style={{ textAlign: 'right' }}><b>{eur(m.deposit_kept)}</b></td></tr>
            <tr><td>Kautionen noch nicht abgerechnet</td><td className="num" style={{ textAlign: 'right' }}>{eur(m.deposit_held)}</td></tr>
            <tr><td>Kautionen noch nicht eingegangen</td><td className="num" style={{ textAlign: 'right' }}>{eur(m.deposit_open)}</td></tr>
          </tbody></table></div>
          <div className="card-foot small muted">Grundlage sind die Häkchen „bezahlt“, „erhalten“ und „abgerechnet“ in den Buchungen und die Online-Zahlungen. Alle Einzelposten stehen in der Excel-Liste.</div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Nutzung nach Art</h2></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Art</th><th style={{ textAlign: 'right' }}>Termine</th><th style={{ textAlign: 'right' }}>Stunden</th></tr></thead>
            <tbody>{cats.map((c) => <tr key={c.id}><td><span className="catdot" style={{ '--c': c.color } as React.CSSProperties}>{c.name}</span></td><td className="num" style={{ textAlign: 'right' }}>{catN.get(c.id)?.n ?? 0}</td><td className="num" style={{ textAlign: 'right' }}>{catN.get(c.id)?.hours ?? 0}</td></tr>)}</tbody>
          </table></div>
          <div className="card-foot small muted">Außerdem: {r.states.rejected} abgelehnt, {r.states.cancelled} storniert, {r.states.expired} nicht bestätigt verfallen.{r.feedback.n > 0 && ` Rückmeldungen: ${r.feedback.n}, Ø ${r.feedback.avg.toLocaleString('de-DE', { maximumFractionDigits: 1 })} von 5, ${r.feedback.damages} Schadensmeldung(en).`}</div>
        </section>
      </div>

      <div className="grid-2b">
        <section className="card">
          <div className="card-head"><h2>Nach Mannschaft und Abteilung</h2></div>
          {r.byTeam.length === 0 ? <div className="empty">Keine Termine in {year}.</div> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Mannschaft / Abteilung</th><th style={{ textAlign: 'right' }}>Termine</th><th style={{ textAlign: 'right' }}>Stunden</th></tr></thead>
              <tbody>{r.byTeam.map((b) => <tr key={b.team}><td>{b.team}</td><td className="num" style={{ textAlign: 'right' }}>{b.n}</td><td className="num" style={{ textAlign: 'right' }}>{b.hours}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>
        <section className="card">
          <div className="card-head"><h2>Nach Monat</h2></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Monat</th><th style={{ textAlign: 'right' }}>Termine</th><th style={{ textAlign: 'right' }}>Stunden</th><th style={{ textAlign: 'right' }}>Entgelte</th></tr></thead>
            <tbody>{months.map((mo) => <tr key={mo.name}><td>{mo.name}</td><td className="num" style={{ textAlign: 'right' }}>{mo.n}</td><td className="num" style={{ textAlign: 'right' }}>{mo.hours}</td><td className="num" style={{ textAlign: 'right' }}>{eur(mo.rent)}</td></tr>)}</tbody>
            <tfoot><tr><th>Summe</th><th className="num" style={{ textAlign: 'right' }}>{t.n}</th><th className="num" style={{ textAlign: 'right' }}>{t.hours}</th><th className="num" style={{ textAlign: 'right' }}>{eur(m.rent_paid)}</th></tr></tfoot>
          </table></div>
        </section>
      </div>
    </div>
  );
}
