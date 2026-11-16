import Link from 'next/link';
import { DoorArt } from '@/components/DoorArt';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';

export const metadata = { title: 'Nicht gefunden', robots: { index: false } };

export default async function NotFound() {
  const lang = await getLang();
  const D = t(lang);
  return (
    <main className="wrap narrow error-page">
      <DoorArt />
      <h1>{D.error.nfTitle}</h1>
      <p>{D.error.nfText}</p>
      <div className="inline" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" href="/">{D.error.home}</Link>
        <Link className="btn" href="/raum">{D.nav.room}</Link>
        <Link className="btn" href="/meine-buchungen">{D.nav.mine}</Link>
      </div>
    </main>
  );
}
