'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children, exact = false, className }: { href: string; children: React.ReactNode; exact?: boolean; className?: string }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + '/');
  return <Link href={href} className={className} aria-current={active ? 'page' : undefined}>{children}</Link>;
}
