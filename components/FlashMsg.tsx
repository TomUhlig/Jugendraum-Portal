'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';

/** Rückmeldung nach einer Aktion. Entfernt ?ok=/?fehler= aus der Adresse, damit sie beim Neuladen nicht wieder erscheint. Erfolg blendet sich nach 8 Sekunden aus. */
export function FlashMsg({ kind, text, undo }: { kind: 'ok' | 'bad'; text: string; undo?: { auditId: string; action: (fd: FormData) => Promise<void> } }) {
  const [open, setOpen] = useState(true);
  const [path, setPath] = useState('/admin');
  useEffect(() => { setPath(window.location.pathname); }, []);
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has('ok') || u.searchParams.has('fehler')) { u.searchParams.delete('ok'); u.searchParams.delete('fehler'); u.searchParams.delete('undo'); window.history.replaceState(window.history.state, '', u.pathname + (u.search ? u.search : '') + u.hash); }
    } catch {}
    if (kind === 'ok') { const t = setTimeout(() => setOpen(false), undo ? 20000 : 8000); return () => clearTimeout(t); }
  }, [kind, text]);
  if (!open) return null;
  const Icon = kind === 'ok' ? CheckCircle2 : XCircle;
  return (
    <div className={`alert alert-${kind} fade-in flash`} role={kind === 'ok' ? 'status' : 'alert'}>
      <Icon className="icon" /><div>{text}{undo && <form action={undo.action} className="undo-form"><input type="hidden" name="auditId" value={undo.auditId} /><input type="hidden" name="fromFlash" value="1" /><input type="hidden" name="back" value={path} /><button className="btn btn-sm" type="submit">Rückgängig</button></form>}</div>
      <button type="button" className="flash-x" aria-label="Schließen" onClick={() => setOpen(false)}><X className="icon-sm" /></button>
    </div>
  );
}
