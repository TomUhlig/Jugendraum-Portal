import { CalendarClock, PartyPopper, Users } from 'lucide-react';
import BookingApp from '@/components/BookingApp';
import { turnstileEnabled, turnstileSiteKey } from '@/lib/antispam';
import { getExtras, getPublicOccupancy, listPhotos } from '@/lib/data';
import { Gallery } from '@/components/Gallery';
import { addDays, berlinToUtc, berlinYmd } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const ok = (v: string | undefined, re: RegExp) => (v && re.test(v) ? v : undefined);
  const prefill = { date: ok(sp.datum, /^\d{4}-\d\d-\d\d$/), start: ok(sp.von, /^\d\d:[0-5]\d$/), end: ok(sp.bis, /^\d\d:[0-5]\d$/), categoryId: ok(sp.art, /^[a-z]{2,20}$/) };
  const month = (prefill.date ?? berlinYmd(Date.now())).slice(0, 8) + '01';
  const [initial, extras, photos] = await Promise.all([
    getPublicOccupancy(berlinToUtc(addDays(month, -7), '00:00'), berlinToUtc(addDays(month, 45), '00:00')),
    getExtras(),
    listPhotos(),
  ]);
  return (
    <main>
      <section className="intro">
        <div className="wrap">
          <h1>Jugendraum anfragen</h1>
          <p>Für Trainerbesprechungen, Mannschaftsabende, Vereinsveranstaltungen und private Feiern. Freie Zeiten siehst du direkt, das Orga-Team bestätigt deine Anfrage per E-Mail.</p>
          <ul className="facts">
            <li><Users className="icon" />bis {initial.settings.capacity} Personen</li>
            <li><PartyPopper className="icon" />eine Feier pro Wochenende</li>
            <li><CalendarClock className="icon" />Feiern mind. {initial.settings.partyMinLeadDays} Tage vorher anfragen</li>
          </ul>
        </div>
      </section>
      {photos.length > 0 && <section className="wrap photos-band" aria-label="Fotos vom Raum"><Gallery photos={photos} variant="strip" /></section>}
      <BookingApp initial={initial} initialMonth={month} contactNote={extras.contactNote} prefill={prefill} turnstileKey={turnstileEnabled() ? turnstileSiteKey() : ''} />
    </main>
  );
}
