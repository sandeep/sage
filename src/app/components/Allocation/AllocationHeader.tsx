'use client';

interface AllocationHeaderProps {
    hasChanges: boolean;
    onReset: () => void;
    saveError?: string;
    saveSuccess?: boolean;
}

export default function AllocationHeader({ 
    hasChanges, 
    onReset, 
    saveError, 
    saveSuccess 
}: AllocationHeaderProps) {
    return (
        <>
            {/* NOTIFICATIONS */}
            <div className="fixed top-8 right-8 z-50 space-y-4">
                {saveError && (
                    <div className="bg-rose-950 border border-rose-900 text-rose-400 text-xs font-black px-8 py-4 rounded-sm shadow-2xl animate-in slide-in-from-right-4">
                        {saveError}
                    </div>
                )}
                {saveSuccess && (
                    <div className="bg-emerald-950 border border-emerald-900 text-emerald-400 text-xs font-black px-8 py-4 rounded-sm shadow-2xl animate-in slide-in-from-right-4">
                        STRATEGY CONVERGED: ALLOCATION SAVED.
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center mb-8 border-b border-zinc-900 pb-6">
                <div className="text-ui-label text-zinc-500">Strategy Components</div>
                {hasChanges && (
                    <button 
                        onClick={onReset}
                        className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 transition-colors border-b border-rose-900/30 pb-1"
                    >
                        Reset to Saved
                    </button>
                )}
            </div>
        </>
    );
}
