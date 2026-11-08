export type StatusKey = 'pending_email' | 'requested' | 'confirmed' | 'rejected' | 'cancelled' | 'expired';
export const STATUS_LABEL: Record<StatusKey, string> = {
  pending_email: 'E-Mail unbestätigt', requested: 'Angefragt', confirmed: 'Bestätigt', rejected: 'Abgelehnt', cancelled: 'Storniert', expired: 'Verfallen',
};
export const ROLE_LABEL = { admin: 'Admin', manager: 'Verwalter', viewer: 'Lesezugriff' } as const;
export const eur = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 });
export const initials = (n: string) => n.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase();
