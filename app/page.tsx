import { ArrowRight, CalendarClock, PartyPopper, Users } from 'lucide-react';
import Link from 'next/link';
import BookingApp from '@/components/BookingApp';
import { turnstileEnabled, turnstileSiteKey } from '@/lib/antispam';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { getExtras, getPublicOccupancy, listPhotos, nextFreeEvenings } from '@/lib/data';
import { Gallery } from '@/components/Gallery';
import { addDays, berlinParts, berlinToUtc, berlinYmd, hmRange } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const I = t(lang).intro;
  const ok = (v: string | undefined, re: RegExp) => (v && re.test(v) ? v : undefined);
  const prefill = { date: ok(sp.datum, /^\d{4}-\d\d-\d\d$/), start: ok(sp.von, /^\d\d:[0-5]\d$/), end: ok(sp.bis, /^\d\d:[0-5]\d$/), categoryId: ok(sp.art, /^[a-z]{2,20}$/), title: sp.titel?.slice(0, 80), guests: ok(sp.personen, /^\d{1,3}$/), equipment: sp.ausstattung ? sp.ausstattung.split(',').slice(0, 10) : undefined };
  const month = (prefill.date ?? berlinYmd(Date.now())).slice(0, 8) + '01';
  const [initial, extras, photos, free] = await Promise.all([
    getPublicOccupancy(berlinToUtc(addDays(month, -7), '00:00'), berlinToUtc(addDays(month, 45), '00:00')),
    getExtras(),
    listPhotos(),
    nextFreeEvenings(5).catch(() => []),
  ]);
  const hero = photos[0];
  const LOC = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }[lang];
  const wd = new Intl.DateTimeFormat(LOC, { weekday: 'short', timeZone: 'Europe/Berlin' });
  const mo = new Intl.DateTimeFormat(LOC, { month: 'short', timeZone: 'Europe/Berlin' });
  return (
    <main>
      <section className={`hero${hero ? ' has-photo' : ''}`} style={hero ? ({ '--hero-img': `url(/fotos/${hero.id})` } as React.CSSProperties) : undefined}>
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="hero-eyebrow">{I.eyebrow}</span>
            <h1>{I.title}</h1>
            <p>{I.text}</p>
            <div className="hero-cta">
              <a className="btn btn-gelb" href="#anfrage">{I.cta}<ArrowRight className="icon" aria-hidden /></a>
              <Link className="btn btn-glass" href="/raum">{I.more}</Link>
            </div>
            <ul className="facts">
              <li><Users className="icon" />{I.capacity(initial.settings.capacity)}</li>
              <li><PartyPopper className="icon" />{I.oneParty}</li>
              <li><CalendarClock className="icon" />{I.lead(initial.settings.partyMinLeadDays)}</li>
            </ul>
          </div>
          <aside className="hero-card" aria-labelledby="free-h">
            <h2 id="free-h">{I.nextFree}</h2>
            <p>{free.length ? I.nextFreeHint : I.noneFree}</p>
            {free.length > 0 && (
              <ul className="free-list">
                {free.map((f) => (
                  <li key={f.date}>
                    <a href={`/?datum=${f.date}&von=18:00&bis=22:00#anfrage`}>
                      <span className="fd"><small>{wd.format(f.start).replace('.', '')}</small><b>{berlinParts(f.start).day}</b><small>{mo.format(f.start).replace('.', '')}</small></span>
                      <span className="ft">{hmRange(f.start, f.end, lang)}</span>
                      <ArrowRight className="icon" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <a className="hero-card-foot" href="#anfrage">{I.otherDay}</a>
          </aside>
        </div>
      </section>
      {photos.length > 0 && <section className="wrap photos-band" aria-label="Fotos"><Gallery photos={photos} variant="strip" /></section>}
      <div id="anfrage" className="anchor" />
      <BookingApp initial={initial} initialMonth={month} contactNote={extras.contactNote} prefill={prefill} turnstileKey={turnstileEnabled() ? turnstileSiteKey() : ''} lang={lang} />
    </main>
  );
}
