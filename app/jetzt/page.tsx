import { SpontanForm } from '@/components/SpontanForm';
import { turnstileEnabled, turnstileSiteKey } from '@/lib/antispam';
import { getPublicOccupancy, getRooms } from '@/lib/data';
import { addDays, berlinToUtc, berlinYmd } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Heute frei?', description: 'Ist der Jugendraum heute noch frei? Kurze Treffen spontan anfragen.' };

/** „Heute frei?“: freie Zeiten ab jetzt und Schnellanfrage für Mitglieder. */
export default async function Jetzt({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const rooms = await getRooms();
  const room = rooms.find((r) => r.id === sp.raum) ?? rooms[0];
  const today = berlinYmd(Date.now());
  const data = await getPublicOccupancy(berlinToUtc(today, '00:00'), berlinToUtc(addDays(today, 1), '06:00'), room.id);
  return (
    <main className="wrap narrow" style={{ paddingBlock: 28 }}>
      <div className="stack">
        <div><span className="eyebrow">Für Mitglieder · {rooms.length > 1 ? room.name : 'Jugendraum'}</span><h1 style={{ fontSize: '1.9rem' }}>Heute frei?</h1>
          <p className="muted">Kurzfristig ein Treffen im Raum? Zeit antippen, kurz bestätigen, fertig. Die Absprache mit Michael Grieswelle oder Sigrid Brodig gilt auch hier.</p></div>
        <SpontanForm data={{ categories: data.categories, settings: data.settings, slots: data.slots, blackouts: data.blackouts, roomId: room.id }} turnstileKey={turnstileEnabled() ? turnstileSiteKey() : ''} />
      </div>
    </main>
  );
}
