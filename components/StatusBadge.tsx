import { STATUS_LABEL, StatusKey } from '@/lib/labels';
export function StatusBadge({ status }: { status: StatusKey }) {
  return <span className={`badge b-${status}`}>{STATUS_LABEL[status]}</span>;
}
