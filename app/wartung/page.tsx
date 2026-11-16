import { DoorArt } from '@/components/DoorArt';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wartung', robots: { index: false } };

/** Wird bei WARTUNG=1 statt aller öffentlichen Seiten gezeigt (siehe middleware.ts). */
export default async function Wartung() {
  const D = t(await getLang());
  return (
    <main className="wrap narrow error-page">
      <DoorArt variant="tools" />
      <h1>{D.error.maintTitle}</h1>
      <p>{D.error.maintText}</p>
    </main>
  );
}
