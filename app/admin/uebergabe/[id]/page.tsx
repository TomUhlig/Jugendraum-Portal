import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Check, FileDown, KeyRound } from 'lucide-react';
import { SignaturePad } from '@/components/SignaturePad';
import { requireAdmin } from '@/lib/auth';
import { getBooking, getCategories, getSignatures, saveHandoverStep } from '@/lib/data';
import { mails } from '@/lib/mail';
import { berlinHm, fmtLong } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Übergabe', robots: { index: false } };

const OUT_CHECKS = ['Hausordnung besprochen', 'Notausgang und Feuerlöscher gezeigt', 'Raum sauber und ohne Schäden übergeben', 'Telefonnummer für Notfälle bekannt'];
const IN_CHECKS = ['Raum besenrein', 'Küche und Geschirr sauber', 'Müll mitgenommen', 'Fenster zu, Licht aus, Heizung runter', 'Schlüssel zurückgegeben'];

async function save(fd: FormData) {
  'use server';
  const admin = await requireAdmin('manager');
  const id = String(fd.get('id')), kind = fd.get('kind') === 'in' ? 'in' : 'out';
  const sig = String(fd.get('signature') ?? '');
  const back = `/admin/uebergabe/${id}${kind === 'in' ? '?art=rueckgabe' : ''}`;
  if (!sig.startsWith('data:image/png;base64,')) redirect(`${back}${kind === 'in' ? '&' : '?'}fehler=unterschrift`);
  const png = Buffer.from(sig.slice(22), 'base64');
  if (png.length < 500 || png.length > 600_000) redirect(`${back}${kind === 'in' ? '&' : '?'}fehler=unterschrift`);
  const meterRaw = String(fd.get('meter') ?? '').replace(',', '.').trim();
  const meter = meterRaw && isFinite(+meterRaw) ? Math.round(+meterRaw * 10) / 10 : null;
  const checklist = (kind === 'out' ? OUT_CHECKS : IN_CHECKS).filter((_, i) => fd.get(`c${i}`) === 'on');
  const cond = String(fd.get('condition') ?? '');
  await saveHandoverStep(id, admin.name, kind, {
    signer: String(fd.get('signer') ?? '').trim().slice(0, 80) || '–', png, checklist, meter,
    conditionOk: kind === 'in' ? cond !== 'issues' : undefined, damageNote: kind === 'in' ? String(fd.get('damageNote') ?? '').trim().slice(0, 1000) : undefined,
  });
  const b = await getBooking(id);
  if (b && !b.silent) await mails.protocol(b, kind).catch((e) => console.error('Protokoll-Mail:', e));
  redirect(`/admin/uebergabe/${id}?fertig=${kind}`);
}

export default async function Uebergabe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireAdmin('manager');
  const { id } = await params;
  const sp = await searchParams;
  const b = await getBooking(id);
  if (!b) notFound();
  const [cats, sigs] = await Promise.all([getCategories(), getSignatures(id)]);
  const cat = cats.find((c) => c.id === b.categoryId);
  const kind: 'out' | 'in' = sp.art === 'rueckgabe' || (sigs.some((s) => s.kind === 'out') && sp.art !== 'uebergabe') ? 'in' : 'out';
  const done = sp.fertig as 'out' | 'in' | undefined;
  const checks = kind === 'out' ? OUT_CHECKS : IN_CHECKS;
  return (
    <main className="wrap narrow handover" style={{ paddingBlock: 20 }}>
      <div className="between" style={{ marginBottom: 12 }}>
        <Link href={`/admin/buchung/${b.id}`} className="inline small" style={{ textDecoration: 'none' }}><ArrowLeft className="icon-sm" />Zur Buchung</Link>
        {sigs.length > 0 && <a className="btn btn-sm" href={`/admin/uebergabe/${b.id}/protokoll`} target="_blank" rel="noopener"><FileDown className="icon-sm" />Protokoll (PDF)</a>}
      </div>
      {done ? (
        <section className="card card-body stack" style={{ textAlign: 'center', justifyItems: 'center', paddingBlock: 40 }}>
          <span className="seal-big"><Check /></span>
          <h1 style={{ fontSize: '1.5rem' }}>{done === 'out' ? 'Schlüssel übergeben' : 'Rückgabe erfasst'}</h1>
          <p className="muted">{b.silent ? 'Das Protokoll ist gespeichert.' : `${b.name} bekommt das Protokoll als PDF per Mail.`}</p>
          <div className="inline" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <a className="btn" href={`/admin/uebergabe/${b.id}/protokoll`} target="_blank" rel="noopener"><FileDown className="icon-sm" />Protokoll ansehen</a>
            <Link className="btn btn-primary" href={`/admin/buchung/${b.id}`}>Fertig</Link>
          </div>
        </section>
      ) : (
        <form action={save} className="card">
          <input type="hidden" name="id" value={b.id} /><input type="hidden" name="kind" value={kind} />
          <div className="card-head"><div><span className="eyebrow">{kind === 'out' ? 'Schlüsselübergabe' : 'Rückgabe'} · <span className="refno">{b.number}</span></span><h1 style={{ fontSize: '1.4rem' }}>{b.title}</h1>
            <p>{fmtLong(b.start)}, {berlinHm(b.start)}–{berlinHm(b.end)} Uhr · {cat?.name} · {b.guests} Pers.</p></div><KeyRound className="icon" style={{ color: 'var(--brand-ink)' }} /></div>
          <div className="card-body stack">
            {sp.fehler === 'unterschrift' && <div className="alert alert-bad"><div>Bitte unterschreiben, bevor du speicherst.</div></div>}
            <div className="segmented" role="group" style={{ justifySelf: 'start' }}>
              <Link href={`/admin/uebergabe/${b.id}?art=uebergabe`} aria-current={kind === 'out' ? 'page' : undefined}>Übergabe</Link>
              <Link href={`/admin/uebergabe/${b.id}?art=rueckgabe`} aria-current={kind === 'in' ? 'page' : undefined}>Rückgabe</Link>
            </div>
            <div className="row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="field"><label htmlFor="h-name">{kind === 'out' ? 'Schlüssel erhält' : 'Schlüssel bringt zurück'}</label><input id="h-name" name="signer" defaultValue={b.name} required /></div>
              <div className="field"><label htmlFor="h-meter">Stromzähler (kWh)</label><input id="h-meter" name="meter" inputMode="decimal" placeholder={kind === 'in' && b.meterStart != null ? `Beginn: ${b.meterStart}` : 'z. B. 12345,6'} /></div>
            </div>
            <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="eyebrow">Gemeinsam prüfen</legend>
              {checks.map((c, i) => <label key={c} className="choice"><input type="checkbox" name={`c${i}`} /><span>{c}</span></label>)}
            </fieldset>
            {kind === 'in' && (
              <div className="stack-sm">
                <div className="segmented" role="radiogroup" style={{ justifySelf: 'start' }}>
                  <label className="seg-radio"><input type="radio" name="condition" value="ok" defaultChecked /><span>Alles in Ordnung</span></label>
                  <label className="seg-radio"><input type="radio" name="condition" value="issues" /><span>Mängel</span></label>
                </div>
                <div className="field"><label htmlFor="h-dmg">Mängel oder Schäden (optional)</label><textarea id="h-dmg" name="damageNote" rows={2} /></div>
              </div>
            )}
            <div className="field"><span className="label">Unterschrift {kind === 'out' ? 'Empfänger/in' : 'Bucher/in'}</span>
              <SignaturePad name="signature" label="Mit dem Finger hier unterschreiben" />
              <span className="hint">Mit der Unterschrift wird die Hausordnung anerkannt{kind === 'in' ? ' und der Zustand bei Rückgabe bestätigt' : ''}.</span></div>
          </div>
          <div className="card-foot"><button className="btn btn-primary btn-lg" type="submit" style={{ width: '100%' }}><Check className="icon-sm" />{kind === 'out' ? 'Übergabe abschließen' : 'Rückgabe abschließen'}</button></div>
        </form>
      )}
    </main>
  );
}
