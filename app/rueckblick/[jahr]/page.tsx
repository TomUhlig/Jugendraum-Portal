import { notFound } from 'next/navigation';
import { CalendarCheck, Clock, PartyPopper, Shirt, Star, Users } from 'lucide-react';
import { bookingsForYear, getCategories, getYearReport } from '@/lib/data';
import { berlinParts, fmtLong } from '@/lib/time';
import { appUrl } from '@/lib/url';
import { ShareButton } from '@/components/ShareButton';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ jahr: string }> }) {
  const { jahr } = await params;
  return { title: `Jahresrückblick ${jahr}`, robots: { index: false }, openGraph: { title: `Der Jugendraum ${jahr}`, description: 'Ein Jahr Jugendraum des SV Heepen in Zahlen.' } };
}
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** Jahresrückblick zum Teilen: nur Summen und Mannschaften, keine Namen von Personen. */
export default async function Rueckblick({ params }: { params: Promise<{ jahr: string }> }) {
  const { jahr } = await params;
  const year = Number(jahr), now = new Date().getFullYear();
  if (!/^\d{4}$/.test(jahr) || year < 2020 || year > now) notFound();
  const [r, list, cats] = await Promise.all([getYearReport(year), bookingsForYear(year), getCategories()]);
  if (!r.totals.n) notFound();
  const guests = list.reduce((s, b) => s + b.guests, 0);
  const wdCount = Array(7).fill(0); for (const b of list) wdCount[berlinParts(b.start).weekday]++;
  const topWd = wdCount.indexOf(Math.max(...wdCount));
  const months = Array.from({ length: 12 }, (_, i) => r.byMonth.find((m) => m.m === i + 1)?.n ?? 0);
  const maxM = Math.max(1, ...months), peak = months.indexOf(Math.max(...months));
  const teams = r.byTeam.filter((t) => !['Nicht im Verein', 'Mitglieder ohne Angabe'].includes(t.team as string)).slice(0, 5);
  const maxT = Math.max(1, ...teams.map((t) => t.n as number));
  const longest = [...list].sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  const cat = new Map(cats.map((c) => [c.id, c]));
  const topCat = [...r.byCat].sort((a, b) => (b.n as number) - (a.n as number))[0];
  const url = `${appUrl()}/rueckblick/${year}`;
  const stat = (Icon: typeof Users, v: string | number, l: string) => <div className="rb-stat"><Icon className="icon" /><b>{typeof v === 'number' ? v.toLocaleString('de-DE') : v}</b><span>{l}</span></div>;
  return (
    <main className="rb">
      <header className="rb-hero">
        <div className="wrap narrow">
          <span className="rb-kicker">Jugendraum SV Heepen · Jahresrückblick</span>
          <h1><span>{year}</span> im Jugendraum</h1>
          <p>{r.totals.n} Termine, {r.totals.hours.toLocaleString('de-DE')} Stunden voller Besprechungen, Mannschaftsabende und Feiern. Danke an alle, die den Raum mit Leben füllen.</p>
        </div>
      </header>
      <div className="wrap narrow rb-body">
        <section className="rb-stats">
          {stat(CalendarCheck, r.totals.n, 'Termine')}
          {stat(Clock, r.totals.hours, 'Stunden genutzt')}
          {stat(Users, guests, 'Gäste insgesamt')}
          {stat(PartyPopper, r.totals.parties, 'Feiern')}
          {stat(Shirt, r.totals.teams, 'Mannschaften und Gruppen')}
          {r.feedback.n > 0 && stat(Star, (r.feedback.avg as number).toLocaleString('de-DE', { maximumFractionDigits: 1 }), 'von 5 Sternen')}
        </section>

        <section className="card card-body">
          <h2>Das Jahr Monat für Monat</h2>
          <div className="rb-months" role="img" aria-label={`Termine pro Monat, am meisten im ${MONTHS[peak]}`}>
            {months.map((n, i) => (
              <div key={i} className={i === peak ? 'peak' : ''} title={`${MONTHS[i]}: ${n} Termine`}>
                <span className="rb-val">{i === peak ? n : ''}</span>
                <i style={{ height: `${Math.max(n ? 6 : 0, (n / maxM) * 100)}%` }} />
                <small>{MONTHS[i]}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="rb-facts">
          <div className="card card-body"><span className="eyebrow">Beliebtester Tag</span><b>{WD[topWd]}</b><span className="muted small">{wdCount[topWd]} Termine</span></div>
          <div className="card card-body"><span className="eyebrow">Stärkster Monat</span><b>{['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][peak]}</b><span className="muted small">{months[peak]} Termine</span></div>
          {topCat && <div className="card card-body"><span className="eyebrow">Am häufigsten</span><b>{cat.get(topCat.category_id as string)?.name}</b><span className="muted small">{topCat.n as number} Termine</span></div>}
          {longest && <div className="card card-body"><span className="eyebrow">Längster Termin</span><b>{Math.round((longest.end - longest.start) / 36e5)} Stunden</b><span className="muted small">{fmtLong(longest.start)}</span></div>}
        </section>

        {teams.length > 0 && (
          <section className="card card-body">
            <h2>Am häufigsten im Raum</h2>
            <div className="hbars">{teams.map((t) => (
              <div className="hbar" key={t.team as string}><span>{t.team as string}</span><div className="track2"><div className="fill" style={{ width: `${((t.n as number) / maxT) * 100}%` }} /></div><span className="n">{t.n as number}</span></div>
            ))}</div>
          </section>
        )}

        <section className="rb-thanks">
          <p>Danke an Michael Grieswelle, Sigrid Brodig und alle, die Schlüssel übergeben, aufräumen und mitanpacken.</p>
          <ShareButton url={url} title={`Der Jugendraum ${year}`} label="Rückblick teilen" className="btn btn-gelb" />
        </section>
      </div>
    </main>
  );
}
