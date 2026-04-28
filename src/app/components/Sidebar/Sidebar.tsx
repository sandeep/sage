'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ConsoleSwitcher from './ConsoleSwitcher';

const NavSection = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    {title && (
      <span className="px-4 text-ui-label text-zinc-500 tracking-[0.3em] block mb-4 uppercase">
        {title}
      </span>
    )}
    {children}
  </div>
);

const NavLink = ({ href, children, active }: { href: string; children: React.ReactNode; active: boolean }) => (
  <Link
    href={href}
    className={`flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-all rounded-sm ${
      active ? 'text-white bg-zinc-900' : 'text-zinc-500 hover:text-white hover:bg-zinc-900/50'
    }`}
  >
    {children}
  </Link>
);

export default function Sidebar() {
  const pathname = usePathname();
  
  // Derive active console from URL
  const activeConsole = pathname.startsWith('/active') ? 'active' : 'passive';

  return (
    <aside className="w-[280px] h-screen border-r border-zinc-900 flex flex-col flex-shrink-0 bg-black">
      <div className="px-10 h-16 flex items-center border-b border-zinc-900 mb-10">
        <h1 className="text-ui-hero !text-xl">
          SAGE <span className="text-emerald-500 !not-italic ml-1">v2.0</span>
        </h1>
      </div>

      <ConsoleSwitcher />

      <nav className="flex-1 px-6 space-y-8 overflow-y-auto">
        {activeConsole === 'passive' ? (
          <NavSection>
            <NavLink href="/passive" active={pathname === '/passive'}>Performance</NavLink>
            <NavLink href="/passive/portfolio" active={pathname === '/passive/portfolio'}>Portfolio</NavLink>
            <NavLink href="/admin/allocation" active={pathname === '/admin/allocation'}>Strategy</NavLink>
            <NavLink href="/admin/snapshots" active={pathname === '/admin/snapshots'}>History</NavLink>
          </NavSection>
        ) : (
          <NavSection>
            <NavLink href="/active" active={pathname === '/active'}>Performance</NavLink>
            <NavLink href="/active/ledger" active={pathname === '/active/ledger'}>Ledger</NavLink>
          </NavSection>
        )}
      </nav>
    </aside>
  );
}
