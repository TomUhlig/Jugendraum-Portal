import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getSettings } from '@/lib/data';
import { berlinToUtc, fmtLong } from '@/lib/time';

export const dynamic = 'force-dynamic';

/** Vorschaubild für geteilte Links (WhatsApp, Signal, Facebook …), 1200×630. ?datum=YYYY-MM-DD&von=HH:MM&bis=HH:MM für einen bestimmten Abend. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const datum = u.searchParams.get('datum') ?? '', von = u.searchParams.get('von') ?? '', bis = u.searchParams.get('bis') ?? '';
  const hasDate = /^\d{4}-\d\d-\d\d$/.test(datum);
  const time = /^\d\d:\d\d$/.test(von) && /^\d\d:\d\d$/.test(bis) ? `${von}–${bis} Uhr` : '';
  const root = process.cwd();
  const [bold, reg, logo, s] = await Promise.all([
    readFile(path.join(root, 'assets/fonts/SourceSans3-Bold.ttf')), readFile(path.join(root, 'assets/fonts/SourceSans3-Regular.ttf')),
    readFile(path.join(root, 'public/logo.png')), getSettings().catch(() => ({ capacity: 40 })),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;
  const title = hasDate ? 'Der Jugendraum ist frei' : 'Jugendraum anfragen';
  const line = hasDate ? `${fmtLong(berlinToUtc(datum, '12:00'))}${time ? ` · ${time}` : ''}` : 'Für Besprechungen, Mannschaftsabende und Feiern';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#2E367A', color: '#fff', fontFamily: 'Source Sans', position: 'relative' }}>
        <div style={{ position: 'absolute', right: -160, top: -200, width: 360, height: 1100, display: 'flex', background: 'rgba(255,216,0,0.10)', transform: 'rotate(24deg)' }} />
        <div style={{ position: 'absolute', right: 140, top: -200, width: 60, height: 1100, display: 'flex', background: 'rgba(255,216,0,0.07)', transform: 'rotate(24deg)' }} />
        <div style={{ height: 14, background: '#FFD800', display: 'flex' }} />
        <div style={{ display: 'flex', flexDirection: 'column', padding: '64px 80px', flex: 1, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <img src={logoSrc} width={96} height={96} alt="" />
            <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 40, fontWeight: 700 }}>Jugendraum</span><span style={{ fontSize: 28, color: '#C9CDF2' }}>SV Heepen</span></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ fontSize: 26, color: '#FFD800', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>{hasDate ? 'Freier Termin' : 'Online buchen'}</span>
            <span style={{ fontSize: 86, fontWeight: 700, lineHeight: 1.02 }}>{title}</span>
            <span style={{ fontSize: 38, color: '#E3E6FA' }}>{line}</span>
          </div>
          <div style={{ display: 'flex', gap: 18, fontSize: 28, color: '#C9CDF2' }}>
            <span style={{ display: 'flex', background: '#FFD800', color: '#1b1f4b', fontWeight: 700, padding: '10px 24px', borderRadius: 12 }}>Jetzt anfragen →</span>
            <span style={{ display: 'flex', alignItems: 'center' }}>bis {s.capacity} Personen · eine Feier pro Wochenende</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: 'Source Sans', data: bold, weight: 700 }, { name: 'Source Sans', data: reg, weight: 400 }], headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
