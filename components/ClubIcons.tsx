// Eigene Symbole im Vereinsstil: kräftige Linien, eckige Enden, Motive aus dem Vereinsleben.
// Gleiche Schnittstelle wie lucide (className), damit sie überall eingesetzt werden können.
type P = { className?: string; 'aria-hidden'?: boolean };
const S = ({ className, children }: P & { children: React.ReactNode }) => (
  <svg className={className} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">{children}</svg>
);

/** Taktiktafel: Besprechung */
export const IcTaktik = (p: P) => <S {...p}><rect x="3" y="4" width="18" height="14" /><path d="M7 8l2 2m0-2l-2 2" /><circle cx="16" cy="9" r="1.6" /><path d="M8.5 14.5c2.5-2 5-2 7 0" /><path d="M14 13.4l1.6 1.2-1.4 1.4" /><path d="M9 21h6" /></S>;
/** Trikot mit Nummer: Mannschaft */
export const IcTrikot = (p: P) => <S {...p}><path d="M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z" /><path d="M11 12h2v5" /></S>;
/** Wimpel am Mast: Vereinsveranstaltung */
export const IcWimpel = (p: P) => <S {...p}><path d="M5 21V3" /><path d="M5 4h13l-4 4.5 4 4.5H5" /><path d="M9 8.5h2" /></S>;
/** Klemmbrett mit Haken: Schulung */
export const IcKlemmbrett = (p: P) => <S {...p}><rect x="5" y="4" width="14" height="17" /><path d="M9 2.5h6v3H9z" /><path d="M8.5 11l1.5 1.5 2.5-3" /><path d="M8.5 17h7" /></S>;
/** Wimpelkette: Feier */
export const IcGirlande = (p: P) => <S {...p}><path d="M2 5c6 4 14 4 20 0" /><path d="M5 6.6l1.5 5 2.3-4.2" /><path d="M10.5 7.9L12 13l1.5-5.1" /><path d="M15.2 7.4l2.3 4.2 1.5-5" /><path d="M7 18l1 2m4-3v3m4-2l-1 2" /></S>;
/** Ball: Sonstiges */
export const IcBall = (p: P) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8.2l3.2 2.3-1.2 3.8h-4l-1.2-3.8z" /><path d="M12 8.2V3.3m3.2 7.2l4.5-1.6M14 14.3l2.8 3.8M10 14.3l-2.8 3.8M8.8 10.5L4.3 8.9" /></S>;

export const CAT_ICONS: Record<string, (p: P) => React.ReactElement> = {
  meet: IcTaktik, team: IcTrikot, event: IcWimpel, work: IcKlemmbrett, party: IcGirlande, misc: IcBall,
};
export function CatIcon({ id, className }: { id: string; className?: string }) {
  const I = CAT_ICONS[id] ?? IcBall;
  return <I className={className} />;
}
