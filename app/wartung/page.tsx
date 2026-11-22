import { DoorArt } from '@/components/DoorArt';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { getContacts } from '@/lib/data';
import { DEFAULT_CONTACTS, fillWho } from '@/lib/contacts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wartung', robots: { index: false } };

/** Wird bei WARTUNG=1 statt aller öffentlichen Seiten gezeigt (siehe middleware.ts). */
export default async function Wartung() {
  const lang = await getLang();
  const D = t(lang);
  return (
    <main className="wrap narrow error-page">
      <DoorArt variant="tools" />
      <h1>{D.error.maintTitle}</h1>
      <p>{fillWho(D.error.maintText, (await getContacts().catch(() => DEFAULT_CONTACTS)).map((c) => c.name), lang)}</p>
    </main>
  );
}
