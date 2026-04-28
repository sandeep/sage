'use client';

import { useRouter, usePathname } from 'next/navigation';

export default function ConsoleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();

  // Derive active console from URL
  const activeConsole = pathname.startsWith('/active') ? 'active' : 'passive';

  const handleSwitch = (choice: 'passive' | 'active') => {
    if (choice === 'passive') {
        router.push('/passive');
    } else {
        router.push('/active');
    }
  };

  return (
    <div className="flex bg-[#09090b] border border-zinc-900 p-1 mx-10 mb-6 rounded">
      <button
        onClick={() => handleSwitch('passive')}
        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-center transition-all rounded-sm ${
          activeConsole === 'passive'
            ? 'text-emerald-500 bg-emerald-500/10'
            : 'text-zinc-500 hover:text-white'
        }`}
      >
        Passive
      </button>
      <button
        onClick={() => handleSwitch('active')}
        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-center transition-all rounded-sm ${
          activeConsole === 'active'
            ? 'text-indigo-500 bg-indigo-500/10'
            : 'text-zinc-500 hover:text-white'
        }`}
      >
        Active
      </button>
    </div>
  );
}
