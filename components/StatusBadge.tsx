import { STATUS_LABEL, StatusKey } from '@/lib/labels';
import { t, type Lang } from '@/lib/i18n';
export function StatusBadge({ status, lang }: { status: StatusKey; lang?: Lang }) {
  return <span className={`badge b-${status}`}>{lang ? t(lang).status[status] : STATUS_LABEL[status]}</span>;
}
