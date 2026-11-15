'use client';
export function PrintLink({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return <button type="button" className="btn btn-primary" onClick={() => window.print()}>{icon}{label}</button>;
}
