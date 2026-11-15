import { CalendarClock, Clock, PartyPopper, ShieldCheck, Users } from 'lucide-react';
import { getCategories, getExtras, getRecurring, getSettings, listPhotos } from '@/lib/data';
import { Gallery } from '@/components/Gallery';
import { describeRecurring } from '@/lib/rules';
import { KEY_RULES, hausordnung } from '@/lib/hausordnung';
import { LOCALE, catLabel } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { raumText } from '@/lib/raum-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Raum & Regeln' };
const IDS = ['raum', 'ablauf', 'feiern', 'puffer', 'kosten', 'uebergabe', 'hausordnung', 'storno', 'datenschutz'];

export default async function Raum() {
  const [cats, s, x, rec, photos, lang] = await Promise.all([getCategories(), getSettings(), getExtras(), getRecurring(), listPhotos(), getLang()]);
  const T = raumText(lang, { capacity: s.capacity, fromH: s.weekendFromHour, untilH: String(s.weekendUntilHour).padStart(2, '0'), latest: s.partyLatestEnd, lead: s.partyMinLeadDays, whole: s.partyBlocksWholeWeekend });
  const eur = (n: number) => n.toLocaleString(LOCALE[lang], { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 });
  const today = new Date().toISOString().slice(0, 10);
  const fixed = rec.filter((r) => !r.validUntil || r.validUntil >= today);
  const hasFees = x.feesExternal.rent + x.feesExternal.deposit + x.feesMemberParty.rent + x.feesMemberParty.deposit > 0;
  const H = (i: number) => <h2 id={IDS[i]}>{T.toc[i]}</h2>;
  return (
    <main className="wrap">
      <div className="doc">
        <nav className="toc" aria-label="Inhalt">{IDS.map((id, i) => <a key={id} href={`#${id}`}>{T.toc[i]}</a>)}</nav>
        <article className="prose">
          <div><span className="eyebrow">{T.kicker}</span><h1 style={{ fontSize: '1.9rem' }}>{T.title}</h1></div>
          <p>{T.intro}</p>

          {H(0)}
          {photos.length > 0 && <Gallery photos={photos} />}
          <div className="facts-grid">
            <div className="card fact"><Users className="icon" /><b>{T.capacity}</b><span>{T.capacitySub}</span></div>
            <div className="card fact"><PartyPopper className="icon" /><b>{T.party}</b><span>{T.partySub}</span></div>
            <div className="card fact"><Clock className="icon" /><b>{T.latest}</b><span>{T.latestSub}</span></div>
            <div className="card fact"><CalendarClock className="icon" /><b>{T.lead}</b><span>{T.leadSub}</span></div>
          </div>
          {fixed.length > 0 && (
            <div className="card card-body stack-sm"><b>{T.fixed}</b>
              <ul style={{ margin: 0 }}>{fixed.map((r) => <li key={r.id}>{describeRecurring(r, lang)}{r.scope === 'party' ? T.onlyParties : ''}: {r.reason}</li>)}</ul></div>
          )}
          {x.equipment.length > 0 && <p><b>{T.equipment}</b> {x.equipment.join(', ')}. {T.equipmentTail}</p>}

          {H(1)}
          <ol>{T.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>

          {H(2)}
          <p>{T.partiesText}</p>

          {H(3)}
          <p>{T.bufferText}</p>
          <div className="card table-wrap"><table><thead><tr><th>{T.kind}</th><th>{T.before}</th><th>{T.after}</th></tr></thead>
            <tbody>{cats.map((c) => <tr key={c.id}><td><span className="catdot" style={{ '--c': c.color } as React.CSSProperties}>{catLabel(lang, c).name}</span></td><td className="num">{c.bufferBefore} {T.min}</td><td className="num">{c.bufferAfter} {T.min}</td></tr>)}</tbody></table></div>

          {H(4)}
          {hasFees ? (
            <div className="card table-wrap"><table><thead><tr>{T.feeHead.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>
              <tr><td>{T.feeRows[0]}</td><td className="num">{eur(x.feesExternal.rent)}</td><td className="num">{eur(x.feesExternal.deposit)}</td></tr>
              <tr><td>{T.feeRows[1]}</td><td className="num">{eur(x.feesMemberParty.rent)}</td><td className="num">{eur(x.feesMemberParty.deposit)}</td></tr>
              <tr><td>{T.feeRows[2]}</td><td>{T.free}</td><td>–</td></tr>
            </tbody></table></div>
          ) : <p>{T.noFees}</p>}
          {hasFees && <p>{T.depositText}</p>}

          {H(5)}
          <ul>{KEY_RULES[lang].map((k) => <li key={k}>{k}</li>)}</ul>

          {H(6)}
          <ul>{hausordnung(s.capacity, lang).map((h) => <li key={h}>{h}</li>)}</ul>

          {H(7)}
          <p>{T.cancelText}</p>

          {H(8)}
          {T.privacy(x.operator).map((p, i) => <p key={i}>{p}</p>)}
          <p className="inline" style={{ marginTop: 8 }}><ShieldCheck className="icon" style={{ color: 'var(--ok)' }} /><span className="muted small">{T.note}</span></p>
        </article>
      </div>
    </main>
  );
}
