'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useWorkspace } from './WorkspaceContext';
import { usePrivacy } from './PrivacyContext';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeConsole, setSyncOpen } = useWorkspace();
  const { privacy, toggle } = usePrivacy();

  const isAlpha = pathname.startsWith('/alpha');

  const getBreadcrumb = () => {
    if (pathname === '/') return 'Portfolio » Overview';
    if (pathname === '/performance') return 'Portfolio » Performance';
    if (pathname.startsWith('/alpha/trades')) return 'Alpha » Trade Log';
    if (pathname.startsWith('/alpha')) return 'Alpha » Performance';
    if (pathname.startsWith('/accounts')) return 'Settings » Accounts';
    if (pathname.startsWith('/admin/snapshots')) return 'Settings » Snapshots';
    return 'Console';
  };

  const syncColor = isAlpha ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500';
  const syncLabel = isAlpha ? 'Import Alpha Data' : 'Sync Fidelity 360 Data';

  const handleSyncClick = () => {
    if (isAlpha) {
      router.push('/alpha/import');
    } else {
      setSyncOpen(true);
    }
  };

  return (
    <header className="h-16 border-b border-zinc-900 flex items-center justify-between px-10 bg-black flex-shrink-0">
      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
        {getBreadcrumb()}
      </div>
      
      <div className="flex items-center gap-6">
        <button
          onClick={() => toggle()}
          className="p-1.5 rounded transition-colors hover:bg-zinc-900"
          title={privacy ? 'Show amounts' : 'Hide amounts'}
        >
          {privacy ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>

        <button 
          onClick={handleSyncClick}
          className={`px-6 py-2 ${syncColor} text-white text-[10px] font-black uppercase tracking-widest transition-all rounded-sm flex items-center gap-2`}
        >
          {syncLabel}
        </button>
      </div>
    </header>
  );
}
