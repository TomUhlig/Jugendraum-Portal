import { ListFilter, Status } from './data';
import { addDays, berlinToUtc } from './time';

const STATUSES: Status[] = ['pending_email', 'requested', 'confirmed', 'rejected', 'cancelled', 'expired'];
/** Liest die Filter der Buchungsliste aus der URL (auch für den CSV-Export). */
export function parseFilter(sp: Record<string, string | undefined>): ListFilter & { zeit: string } {
  const zeit = sp.zeit ?? 'kommend';
  const f: ListFilter & { zeit: string } = { zeit, limit: 1000 };
  if (sp.status && STATUSES.includes(sp.status as Status)) f.status = [sp.status as Status];
  if (sp.art) f.categoryId = sp.art;
  if (sp.typ === 'member' || sp.typ === 'external') f.bookerType = sp.typ;
  if (sp.q) f.search = sp.q.slice(0, 60);
  const now = Date.now();
  if (zeit === 'kommend') f.from = now;
  else if (zeit === 'vergangen') f.to = now;
  else if (/^\d{4}$/.test(zeit)) { f.from = berlinToUtc(`${zeit}-01-01`, '00:00'); f.to = berlinToUtc(addDays(`${zeit}-12-31`, 1), '00:00'); }
  return f;
}
