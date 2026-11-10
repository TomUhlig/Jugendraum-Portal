import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Flash, PageHead } from '@/components/Flash';
import { PhotoUploader } from '@/components/PhotoUploader';
import { requireAdmin } from '@/lib/auth';
import { MAX_PHOTOS, listPhotos } from '@/lib/data';
import { photoCaptionAction, photoDeleteAction, photoMoveAction } from '../../actions';

export default async function Fotos({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const photos = await listPhotos();
  const can = me.role !== 'viewer';
  return (
    <>
      <PageHead eyebrow="Erscheinen auf der Buchungsseite und unter „Raum & Regeln“" title="Fotos vom Raum" />
      <Flash sp={sp} />
      {can && <section className="card card-body"><PhotoUploader remaining={MAX_PHOTOS - photos.length} /></section>}
      {photos.length === 0 ? <section className="card"><div className="empty">Noch keine Fotos. Gute Motive: der Raum von der Tür aus, Küche, Sitzbereich, Außenbereich mit Grill. Bitte keine Personen ohne deren Einverständnis.</div></section> : (
        <div className="photo-admin">{photos.map((p, i) => (
          <article key={p.id} className="card">
            <img src={`/fotos/${p.id}?g=klein`} alt={p.caption || 'Foto'} />
            <div className="card-body stack-sm" style={{ padding: 12 }}>
              <form action={photoCaptionAction} className="inline" style={{ flexWrap: 'nowrap' }}>
                <input type="hidden" name="id" value={p.id} />
                <input type="text" name="caption" defaultValue={p.caption} maxLength={140} placeholder="Bildunterschrift" aria-label="Bildunterschrift" disabled={!can} style={{ minHeight: 36, padding: '6px 10px' }} />
                {can && <button className="btn btn-sm" type="submit">OK</button>}
              </form>
              {can && <div className="between">
                <div className="inline">
                  <form action={photoMoveAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="dir" value="-1" /><button className="iconbtn" type="submit" disabled={i === 0} aria-label="Nach vorne"><ArrowUp className="icon-sm" /></button></form>
                  <form action={photoMoveAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="dir" value="1" /><button className="iconbtn" type="submit" disabled={i === photos.length - 1} aria-label="Nach hinten"><ArrowDown className="icon-sm" /></button></form>
                </div>
                <form action={photoDeleteAction}><input type="hidden" name="id" value={p.id} /><button className="btn btn-sm btn-danger" type="submit"><Trash2 className="icon-sm" />Löschen</button></form>
              </div>}
            </div>
          </article>
        ))}</div>
      )}
    </>
  );
}
