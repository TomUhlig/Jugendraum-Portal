'use client';
import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

/** Teilen über das Handy-Menü (WhatsApp, Signal …), sonst Link kopieren. */
export function ShareButton({ url, title, label, className = 'btn' }: { url: string; title: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => {
      try {
        if (navigator.share) { await navigator.share({ title, url }); return; }
        await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000);
      } catch {}
    }}>{copied ? <Check className="icon-sm" /> : <Share2 className="icon-sm" />}{copied ? 'Link kopiert' : label}</button>
  );
}
