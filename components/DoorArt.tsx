/** Kleine Illustration: Tür des Jugendraums mit Vereinsfarben (für Fehler- und Wartungsseiten). */
export function DoorArt({ variant = 'closed' }: { variant?: 'closed' | 'tools' }) {
  return (
    <svg className="door-art" viewBox="0 0 220 180" role="img" aria-hidden>
      <rect x="0" y="160" width="220" height="4" rx="2" fill="var(--line-strong)" />
      <rect x="62" y="22" width="96" height="138" rx="6" fill="var(--brand)" />
      <rect x="70" y="30" width="80" height="130" rx="3" fill="color-mix(in srgb, var(--brand) 82%, #000)" />
      <rect x="78" y="40" width="64" height="36" rx="3" fill="var(--gelb)" opacity=".9" />
      <path d="M78 76 L142 40" stroke="color-mix(in srgb, var(--brand) 82%, #000)" strokeWidth="2" opacity=".35" />
      <circle cx="136" cy="102" r="5" fill="var(--gelb)" />
      <rect x="132" y="108" width="8" height="12" rx="2" fill="var(--gelb)" />
      <text x="110" y="64" textAnchor="middle" fontSize="15" fontWeight="800" fill="#1b1f4b" fontFamily="var(--f-display)">{variant === 'tools' ? '…' : '404'}</text>
      {variant === 'closed' ? (
        <g transform="translate(160 118) rotate(-20)"><circle cx="0" cy="0" r="9" fill="none" stroke="var(--gelb)" strokeWidth="4" /><rect x="8" y="-2.5" width="26" height="5" rx="2" fill="var(--gelb)" /><rect x="26" y="2" width="4" height="7" fill="var(--gelb)" /><rect x="18" y="2" width="4" height="5" fill="var(--gelb)" /></g>
      ) : (
        <g transform="translate(18 120)"><rect x="0" y="10" width="40" height="28" rx="4" fill="var(--warn)" /><rect x="12" y="2" width="16" height="10" rx="3" fill="none" stroke="var(--warn)" strokeWidth="4" /><rect x="0" y="20" width="40" height="3" fill="color-mix(in srgb, var(--warn) 60%, #000)" /></g>
      )}
    </svg>
  );
}
