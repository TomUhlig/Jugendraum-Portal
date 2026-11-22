import { ArrowRight, CalendarClock, Clock, PartyPopper, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { TocSpy } from '@/components/TocSpy';
import { nextFreeEvenings } from '@/lib/data';
import { t } from '@/lib/i18n';
import { fmtDay, hmRange } from '@/lib/time';
import { getCategories, getContacts, getExtras, getRecurring, getSettings, listPhotos } from '@/lib/data';
import { initials } from '@/lib/contacts';
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
  const [cats, s, x, rec, photos, lang, free, contacts] = await Promise.all([getCategories(), getSettings(), getExtras(), getRecurring(), listPhotos(), getLang(), nextFreeEvenings(3).catch(() => []), getContacts()]);
  const D = t(lang);
  const T = raumText(lang, { people: contacts.map((c) => c.name), capacity: s.capacity, fromH: s.weekendFromHour, untilH: String(s.weekendUntilHour).padStart(2, '0'), latest: s.partyLatestEnd, lead: s.partyMinLeadDays, whole: s.partyBlocksWholeWeekend });
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
          <ol className="step-list">{T.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>

          <div className="card cta-card cta-inline">
            <b>{D.intro.title}</b>
            {free.length > 0 && <p>{D.intro.nextFree}: {free.map((f) => fmtDay(f.start, lang)).join(' · ')}</p>}
            <Link className="btn btn-gelb" href="/#anfrage">{D.intro.cta}<ArrowRight className="icon-sm" /></Link>
          </div>

          {H(2)}
          <p>{T.partiesText}</p>

          {H(3)}
          <p>{T.bufferText}</p>
          <div className="card table-wrap"><table><thead><tr><th>{T.kind}</th><th>{T.before}</th><th>{T.after}</th></tr></thead>
            <tbody>{cats.map((c) => <tr key={c.id}><td><span className="catdot" style={{ '--c': c.color } as React.CSSProperties}>{catLabel(lang, c).name}</span></td><td className="num">{c.bufferBefore} {T.min}</td><td className="num">{c.bufferAfter} {T.min}</td></tr>)}</tbody></table></div>

          {H(4)}
          {hasFees ? (
            <div className="card table-wrap"><table><thead><tr>{T.feeHead.map((h, i) => <th key={i}>{h || <span className="sr-only">{T.kind}</span>}</th>)}</tr></thead><tbody>
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
        <aside className="doc-aside">
          <div className="card cta-card">
            <b>{D.intro.title}</b>
            <p>{D.intro.nextFree}:</p>
            {free.length > 0 && <ul>{free.map((f) => <li key={f.date}><Link href={`/?datum=${f.date}&von=18:00&bis=22:00#anfrage`}><span>{fmtDay(f.start, lang)}</span><span className="num">{hmRange(f.start, f.end, lang)}</span></Link></li>)}</ul>}
            <Link className="btn btn-gelb" href="/#anfrage">{D.intro.cta}<ArrowRight className="icon-sm" /></Link>
          </div>
          <div className="card card-body stack-sm">
            <b className="small">{D.app.contacts}</b>
            {contacts.map((c) => <div key={c.name} className="contact">{c.photo ? <img className="avatar" src={c.photo} alt="" /> : <span className="avatar">{initials(c.name)}</span>}<div><b className="small">{c.name}</b><br /><span className="muted small">{(lang === 'de' && c.role) || D.app.contactRole}</span>{c.showPhone && c.phone && <><br /><a className="small num" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>{c.phone}</a></>}</div></div>)}
          </div>
        </aside>
      </div>
      <TocSpy />
    </main>
  );
}
