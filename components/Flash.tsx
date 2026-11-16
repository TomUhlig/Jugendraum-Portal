import { FlashMsg } from './FlashMsg';
export function Flash({ sp }: { sp: Record<string, string | undefined> }) {
  if (sp.ok) return <FlashMsg kind="ok" text={sp.ok} />;
  if (sp.fehler) return <FlashMsg kind="bad" text={sp.fehler} />;
  return null;
}
export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return <div className="page-head" style={{ paddingInline: 0 }}><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1></div>{children && <div className="inline">{children}</div>}</div>;
}
