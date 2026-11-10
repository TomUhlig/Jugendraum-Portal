'use client';
import { ImagePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Verkleinert ein Bild im Browser auf maxSize Pixel (längste Seite) und gibt ein JPEG zurück. */
async function shrink(file: File, maxSize: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale), height = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); ctx.drawImage(bmp, 0, 0, width, height);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Bild konnte nicht umgewandelt werden.'))), 'image/jpeg', quality));
  return { blob, width, height };
}

export function PhotoUploader({ remaining }: { remaining: number }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy: boolean; msg: string; bad: boolean }>({ busy: false, msg: '', bad: false });
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, remaining);
    setState({ busy: true, msg: '', bad: false });
    let ok = 0; let error = '';
    for (const [i, file] of list.entries()) {
      setState({ busy: true, msg: `Lade Foto ${i + 1} von ${list.length} hoch …`, bad: false });
      try {
        if (!file.type.startsWith('image/')) throw new Error(`${file.name} ist kein Bild.`);
        const full = await shrink(file, 1600, 0.82), thumb = await shrink(file, 640, 0.78);
        const fd = new FormData();
        fd.append('full', full.blob, 'foto.jpg'); fd.append('thumb', thumb.blob, 'vorschau.jpg');
        fd.append('width', String(full.width)); fd.append('height', String(full.height));
        const res = await fetch('/api/fotos', { method: 'POST', body: fd });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Upload fehlgeschlagen.');
        ok++;
      } catch (e) { error = (e as Error).message; }
    }
    setState({ busy: false, msg: error ? `${ok} hochgeladen. ${error}` : `${ok} ${ok === 1 ? 'Foto' : 'Fotos'} hochgeladen.`, bad: !!error });
    router.refresh();
  }
  if (remaining <= 0) return <p className="muted small">Die Höchstzahl von Fotos ist erreicht. Lösche ein Foto, um ein neues hochzuladen.</p>;
  return (
    <div className="stack-sm">
      <label className={`upload-drop${state.busy ? ' busy' : ''}`}>
        <input type="file" accept="image/*" multiple disabled={state.busy} onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        <ImagePlus className="icon" /><span><b>Fotos auswählen</b> oder hierher ziehen<br /><span className="muted small">JPG, PNG oder HEIC vom Handy · werden automatisch verkleinert · noch {remaining} möglich</span></span>
      </label>
      {state.msg && <p className={state.bad ? 'field-error' : 'muted small'} role="status">{state.msg}</p>}
    </div>
  );
}
