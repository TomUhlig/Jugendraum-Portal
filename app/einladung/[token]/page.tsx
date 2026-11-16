import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { CalendarPlus, Clock, MapPin } from 'lucide-react';
import { bookingIdFromGuestToken } from '@/lib/auth';
import { getBooking, getExtras } from '@/lib/data';
import { getLang } from '@/lib/lang';
import { GUEST_TX } from '@/lib/guest-text';
import { googleCalendarLink } from '@/lib/gcal-link';
import { appUrl } from '@/lib/url';
import { berlinHm, berlinYmd, fmtDay, fmtLong } from '@/lib/time';
import { ShareButton } from '@/components/ShareButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const id = bookingIdFromGuestToken((await params).token);
  const b = id ? await getBooking(id) : null;
  return { title: b ? b.title : 'Einladung', robots: { index: false }, openGraph: b ? { title: `Einladung: ${b.title}`, description: `${fmtLong(b.start)}, ${berlinHm(b.start)} Uhr · Jugendraum SV Heepen` } : undefined };
}

/** Gäste-Karte: Termin, Ort, Anfahrt und ein paar Hausregeln. Ohne Namen und Kontaktdaten des Buchers. */
export default async function Einladung({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = bookingIdFromGuestToken(token);
  const b = id ? await getBooking(id) : null;
  if (!b || !['confirmed', 'cancelled'].includes(b.status)) notFound();
  const lang = await getLang();
  const T = GUEST_TX[lang];
  const op = (await getExtras()).operator;
  const addr = (op.roomAddress || '').trim();
  const url = `${appUrl()}/einladung/${token}`;
  const qr = await QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#161A33ff', light: '#00000000' } });
  const sameDay = berlinYmd(b.start) === berlinYmd(b.end);
  return (
    <main className="wrap narrow invite">
      <article className="invite-card">
        <header>
          <span className="invite-kicker">{T.kicker} · Jugendraum SV Heepen</span>
          <h1>{b.title}</h1>
          <p>{T.invited}</p>
        </header>
        {b.status === 'cancelled' ? <div className="alert alert-bad"><div>{T.cancelled}</div></div> : (<>
          <div className="invite-facts">
            <div><Clock className="icon" /><span><small>{T.when}</small><b>{fmtLong(b.start, lang)}</b><span>{berlinHm(b.start)} {T.until} {sameDay ? '' : fmtDay(b.end, lang) + ', '}{berlinHm(b.end)}{lang === 'de' ? ' Uhr' : ''}</span></span></div>
            {addr && <div><MapPin className="icon" /><span><small>{T.where}</small><b style={{ whiteSpace: 'pre-line' }}>{addr}</b>{op.roomHint && <span>{op.roomHint}</span>}
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr.replace(/\n/g, ', '))}`} target="_blank" rel="noopener">{T.map}</a></span></div>}
          </div>
          <div className="inline" style={{ flexWrap: 'wrap' }}>
            <a className="btn btn-primary" href={`/einladung/${token}/kalender`}><CalendarPlus className="icon-sm" />{T.toCal}</a>
            <a className="btn" target="_blank" rel="noopener" href={googleCalendarLink({ title: b.title, start: b.start, end: b.end, location: addr.replace(/\n/g, ', ') || 'Jugendraum SV Heepen', details: url })}>{T.toGoogle}</a>
            <ShareButton url={url} title={b.title} label={T.share} />
          </div>
          <section className="invite-rules"><h2>{T.rules}</h2><ul>{T.rulesList.map((r) => <li key={r}>{r}</li>)}</ul></section>
        </>)}
        <footer><span className="invite-qr" dangerouslySetInnerHTML={{ __html: qr }} /><span className="muted small">{url.replace(/^https?:\/\//, '')}</span></footer>
      </article>
    </main>
  );
}
