import Link from 'next/link';
import type { ReactNode } from 'react';
import { logout } from '@/lib/actions/auth';

const TABS = [
  ['/play', 'Home'],
  ['/play/inventory', 'Inventory'],
  ['/play/storage', 'Storage'],
  ['/play/barter', 'Barter'],
  ['/play/character', 'Character'],
] as const;

/** Kerangka halaman pemain: judul = nama karakter, tab navigasi, logout. */
export function PlayShell({ title, active, children }: { title: string; active: string; children: ReactNode }) {
  return (
    <div className="workspace player-workspace">
      <aside className="workspace-sidebar">
        <Link href="/play" className="workspace-brand">Scavenge<br />Tracker</Link>
        <span className="workspace-identity">{title}</span>
        <nav className="workspace-nav" aria-label="Sections">
          {TABS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={href === active ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>
        <form action={logout} className="workspace-logout">
          <button type="submit">Logout <span aria-hidden="true">-&gt;</span></button>
        </form>
      </aside>
      <div className="app workspace-content">
        <header className="hdr">
          <h1>{title}</h1>
          <form action={logout}>
            <button type="submit" className="icon-plain" style={{ width: 'auto', padding: '0 8px' }}>Logout</button>
          </form>
        </header>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={href === active ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
