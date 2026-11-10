'use client';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
export function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="copytext"><span className="num">{text}</span>
      <button type="button" className="iconbtn-sm" aria-label="Kopieren" title="Kopieren" onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* Kopieren nicht erlaubt */ }
      }}>{done ? <Check className="icon-sm" /> : <Copy className="icon-sm" />}</button></span>
  );
}
