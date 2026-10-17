import Link from 'next/link';
import type { ReactNode } from 'react';
import { logout } from '@/lib/actions/auth';
import { ChevronLeftIcon, MenuIcon } from './Icons';

/** Judul halaman (huruf besar) + menu hamburger. Menu memakai <details>, jadi tidak butuh JavaScript. */
export function Header({ title }: { title: string }) {
  return (
    <header className="hdr">
      <h1>{title}</h1>
      <details className="menu">
        <summary aria-label="Menu"><MenuIcon /></summary>
        <nav className="menu-panel">
          <Link href="/dm">Dashboard</Link>
          <Link href="/dm/items">Items</Link>
          <Link href="/dm/zones">Zones</Link>
          <Link href="/dm/logs">Logs</Link>
          <Link href="/dm/characters">Characters</Link>
          <form action={logout}><button type="submit">Logout</button></form>
        </nav>
      </details>
    </header>
  );
}

/** Baris "< Judul   KANAN" di bawah header, untuk halaman form dan detail. */
export function SubHeader({
  back,
  title,
  right,
  rightClass,
}: {
  back: string;
  title: string;
  right?: ReactNode;
  rightClass?: string;
}) {
  return (
    <div className="sub rule">
      <Link href={back} className="back" aria-label="Back">
        <ChevronLeftIcon />
        <span>{title}</span>
      </Link>
      {right !== undefined && <span className={`right ${rightClass ?? ''}`}>{right}</span>}
    </div>
  );
}
