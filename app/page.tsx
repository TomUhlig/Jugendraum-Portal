import { CalendarClock, PartyPopper, Users } from 'lucide-react';
import BookingApp from '@/components/BookingApp';
import { getExtras, getPublicOccupancy } from '@/lib/data';
import { addDays, berlinToUtc, berlinYmd } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const month = berlinYmd(Date.now()).slice(0, 8) + '01';
  const [initial, extras] = await Promise.all([
    getPublicOccupancy(berlinToUtc(addDays(month, -7), '00:00'), berlinToUtc(addDays(month, 45), '00:00')),
    getExtras(),
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
      <BookingApp initial={initial} initialMonth={month} contactNote={extras.contactNote} />
    </main>
  );
}
