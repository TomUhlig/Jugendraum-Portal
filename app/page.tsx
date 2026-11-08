import BookingApp from '@/components/BookingApp';
import { getPublicOccupancy } from '@/lib/data';
import { addDays, berlinToUtc, berlinYmd } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const month = berlinYmd(Date.now()).slice(0, 8) + '01';
  const initial = await getPublicOccupancy(berlinToUtc(addDays(month, -7), '00:00'), berlinToUtc(addDays(month, 45), '00:00'));
  return (
    <main>
      <section className="hero">
        <div className="wrap">
          <h1>Euer Raum.<br /><em>Euer Abend.</em></h1>
          <p>Trainerbesprechung, Mannschaftsabend oder der 40. Geburtstag: Hier fragst du den Jugendraum am Sportplatz an. Freie Zeiten siehst du sofort, das Orga-Team bestätigt deine Anfrage per Mail.</p>
          <div className="facts">
            <span><b>{initial.settings.capacity}</b> Personen max.</span>
            <span><b>1</b> Party pro Wochenende</span>
            <span><b>Absprache</b> mit Michael Grieswelle oder Sigrid Brodig</span>
          </div>
        </div>
      </section>
      <BookingApp initial={initial} initialMonth={month} />
    </main>
  );
}
