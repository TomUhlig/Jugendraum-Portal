import { CheckCircle2, XCircle } from 'lucide-react';
export function Flash({ sp }: { sp: Record<string, string | undefined> }) {
  if (sp.ok) return <div className="alert alert-ok fade-in" role="status"><CheckCircle2 className="icon" /><div>{sp.ok}</div></div>;
  if (sp.fehler) return <div className="alert alert-bad fade-in" role="alert"><XCircle className="icon" /><div>{sp.fehler}</div></div>;
  return null;
}
export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return <div className="page-head" style={{ paddingInline: 0 }}><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1></div>{children && <div className="inline">{children}</div>}</div>;
}
