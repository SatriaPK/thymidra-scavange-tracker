'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/lib/actions/auth';

const LINKS = [
  ['/dm', 'Dashboard'],
  ['/dm/characters', 'Characters'],
  ['/dm/items', 'Items'],
  ['/dm/zones', 'Zones'],
  ['/dm/recipes', 'Recipes'],
  ['/dm/logs', 'Logs'],
] as const;

export function DmSidebar({ campaignName }: { campaignName: string }) {
  const pathname = usePathname();

  return (
    <aside className="workspace-sidebar">
      <Link href="/dm" className="workspace-brand">Scavenge<br />Tracker</Link>
      <span className="workspace-identity">{campaignName}</span>
      <nav className="workspace-nav" aria-label="DM sections">
        {LINKS.map(([href, label]) => {
          const active = href === '/dm' ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? 'page' : undefined}>{label}</Link>;
        })}
      </nav>
      <form action={logout} className="workspace-logout">
        <button type="submit">Logout <span aria-hidden="true">-&gt;</span></button>
      </form>
    </aside>
  );
}
