import { ArrowRight, CalendarClock, PartyPopper, Share2, Users } from 'lucide-react';
import { appUrl } from '@/lib/url';
import Link from 'next/link';
import BookingApp from '@/components/BookingApp';
import { turnstileEnabled, turnstileSiteKey } from '@/lib/antispam';
import { getLang } from '@/lib/lang';
import { LOCALE, t } from '@/lib/i18n';
import { getExtras, getPublicOccupancy, getRooms, listPhotos, nextFreeEvenings } from '@/lib/data';
import { Gallery } from '@/components/Gallery';
import { WeekStrip } from '@/components/WeekStrip';
import { Flap } from '@/components/Flap';
import { addDays, berlinParts, berlinToUtc, berlinYmd, fmtLong, hmRange } from '@/lib/time';

export const dynamic = 'force-dynamic';

/** Geteilte Links auf einen bestimmten Abend bekommen ein eigenes Vorschaubild. */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!/^\d{4}-\d\d-\d\d$/.test(sp.datum ?? '')) return {};
  const q = new URLSearchParams({ datum: sp.datum, ...(sp.von ? { von: sp.von } : {}), ...(sp.bis ? { bis: sp.bis } : {}) });
  const when = `${fmtLong(berlinToUtc(sp.datum, '12:00'))}${sp.von && sp.bis ? `, ${sp.von}–${sp.bis} Uhr` : ''}`;
  return {
    title: `Frei am ${when}`,
    openGraph: { title: `Jugendraum frei: ${when}`, description: 'Jetzt anfragen beim SV Heepen.', images: [{ url: `/og?${q}`, width: 1200, height: 630 }] },
  };
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const I = t(lang).intro;
  const ok = (v: string | undefined, re: RegExp) => (v && re.test(v) ? v : undefined);
  // Geteilter Entwurf (?entwurf=…): enthält nur Angaben zum Termin, keine Kontaktdaten
  let draft: Record<string, unknown> = {};
  if (sp.entwurf && sp.entwurf.length < 3000) { try { draft = JSON.parse(Buffer.from(sp.entwurf, 'base64url').toString('utf8')); } catch {} }
  const ds = (k: string, max = 80) => (typeof draft[k] === 'string' ? (draft[k] as string).slice(0, max) : undefined);
  const prefill = { date: ok(sp.datum, /^\d{4}-\d\d-\d\d$/), start: ok(sp.von, /^\d\d:[0-5]\d$/), end: ok(sp.bis, /^\d\d:[0-5]\d$/), categoryId: ok(sp.art, /^[a-z]{2,20}$/), title: sp.titel?.slice(0, 80), guests: ok(sp.personen, /^\d{1,3}$/), equipment: sp.ausstattung ? sp.ausstattung.split(',').slice(0, 10) : undefined };
  if (sp.entwurf) Object.assign(prefill, {
    date: ok(ds('d', 10), /^\d{4}-\d\d-\d\d$/) ?? prefill.date, start: ok(ds('s', 5), /^\d\d:[0-5]\d$/) ?? prefill.start, end: ok(ds('b', 5), /^\d\d:[0-5]\d$/) ?? prefill.end,
    categoryId: ok(ds('c', 20), /^[a-z]{2,20}$/) ?? prefill.categoryId, title: ds('t') ?? prefill.title, guests: ok(ds('g', 3), /^\d{1,3}$/) ?? prefill.guests,
    note: ds('n', 500), equipment: Array.isArray(draft.e) ? (draft.e as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 10) : prefill.equipment,
  });
  const month = (prefill.date ?? berlinYmd(Date.now())).slice(0, 8) + '01';
  const allRooms = await getRooms();
  const roomParam = allRooms.find((r) => r.id === sp.raum)?.id ?? allRooms[0].id;
  const [initial, extras, photos, free] = await Promise.all([
    getPublicOccupancy(berlinToUtc(addDays(month, -7), '00:00'), berlinToUtc(addDays(month, 45), '00:00'), roomParam),
    getExtras(),
    listPhotos(),
    nextFreeEvenings(5, '18:00', '22:00', roomParam).catch(() => []),
  ]);
  const hero = photos[0];
  const LOC = LOCALE[lang];
  const wd = new Intl.DateTimeFormat(LOC, { weekday: 'short', timeZone: 'Europe/Berlin' });
  const mo = new Intl.DateTimeFormat(LOC, { month: 'short', timeZone: 'Europe/Berlin' });
  return (
    <main>
      <section className={`hero${hero ? ' has-photo' : ''}`} style={hero ? ({ '--hero-img': `url(/fotos/${hero.id})`, '--hero-img-sm': `url(/fotos/${hero.id}?g=klein)` } as React.CSSProperties) : undefined}>
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="hero-eyebrow">{I.eyebrow}</span>
            <h1>{I.title}</h1>
            <p>{I.text}</p>
            <div className="hero-cta">
              <a className="btn btn-gelb" href="#anfrage">{I.cta}<ArrowRight className="icon" aria-hidden /></a>
              <Link className="btn btn-glass" href="/raum">{I.more}</Link>
              {lang === 'de' && <Link className="btn btn-glass" href="/jetzt">Heute frei?</Link>}
            </div>
          </div>
          <aside className="board" aria-labelledby="free-h">
            <div className="board-head">
              <h2 id="free-h">{I.nextFree}{allRooms.length > 1 && <span> · {allRooms.find((r) => r.id === roomParam)?.name}</span>}</h2>
              <span className="board-live">{I.boardLive}</span>
            </div>
            {free.length > 0 ? (
              <ol className="board-rows">
                {free.map((f, i) => (
                  <li key={f.date}>
                    <a href={`/?${allRooms.length > 1 ? `raum=${roomParam}&` : ''}datum=${f.date}&von=18:00&bis=22:00#anfrage`}>
                      <span className="b-wd">{wd.format(f.start).replace('.', '')}</span>
                      <Flap className="b-day" value={String(berlinParts(f.start).day).padStart(2, '0')} delay={150 + i * 110} />
                      <span className="b-mo">{mo.format(f.start).replace('.', '')}</span>
                      <span className="b-time">{hmRange(f.start, f.end, lang)}</span>
                      <ArrowRight className="icon b-go" aria-hidden />
                    </a>
                  </li>
                ))}
              </ol>
            ) : <p className="board-empty">{I.noneFree}</p>}
            <div className="board-foot">
              <a href="#anfrage">{I.otherDay}</a>
              {free.length > 0 && <a className="wa" target="_blank" rel="noopener" href={`https://wa.me/?text=${encodeURIComponent(`${I.nextFree} – Jugendraum SV Heepen:\n${free.map((f) => `• ${wd.format(f.start).replace('.', '')} ${berlinParts(f.start).day}. ${mo.format(f.start).replace('.', '')}, ${hmRange(f.start, f.end, lang)}: ${appUrl()}/?${allRooms.length > 1 ? `raum=${roomParam}&` : ''}datum=${f.date}&von=18:00&bis=22:00`).join('\n')}`)}`}><Share2 className="icon-sm" aria-hidden />{I.share}</a>}
            </div>
          </aside>
        </div>
        <div className="wrap">
          <ul className="stats">
            <li><Users className="icon" aria-hidden /><b><Flap value={String(initial.settings.capacity)} delay={200} /></b><span>{I.statPeople}</span></li>
            <li><PartyPopper className="icon" aria-hidden /><b>1</b><span>{I.statParty}</span></li>
            <li><CalendarClock className="icon" aria-hidden /><b><Flap value={String(initial.settings.partyMinLeadDays)} delay={400} /></b><span>{I.statLead}</span></li>
          </ul>
        </div>
      </section>
      <WeekStrip today={berlinYmd(Date.now())} slots={initial.slots} blackouts={initial.blackouts} categories={initial.categories} days={initial.days} T={I} locale={LOC} roomParam={allRooms.length > 1 ? roomParam : undefined} />
      {photos.length > 0 && <section className="wrap photos-band" aria-label="Fotos"><Gallery photos={photos} variant="strip" /></section>}
      <div id="anfrage" className="anchor" />
      <BookingApp serverNow={Date.now()} initial={initial} initialMonth={month} contactNote={extras.contactNote} prefill={prefill} turnstileKey={turnstileEnabled() ? turnstileSiteKey() : ''} lang={lang} />
    </main>
  );
}
