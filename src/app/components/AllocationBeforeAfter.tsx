'use client';

function Delta({ before, after, suffix = '%', scale = 100 }: {
    before: number; after: number; suffix?: string; scale?: number;
}) {
    const delta = (after - before) * scale;
    const color = delta > 0.05 ? 'text-emerald-400' : delta < -0.05 ? 'text-red-400' : 'text-zinc-500';
    return (
        <span className={`text-[11px] font-black tabular-nums ${color}`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}{suffix}
        </span>
    );
}

export default function AllocationBeforeAfter({
    origCagr, draftCagr, origStock, draftStock, topLevelSum, saving, hasChanges, onAccept,
}: {
    origCagr: number;
    draftCagr: number;
    origStock: number;
    draftStock: number;
    topLevelSum: number;
    saving: boolean;
    hasChanges: boolean;
    onAccept: () => void;
}) {
    const sumOk = Math.abs(topLevelSum - 1) < 0.001;
    return (
        <div className="card space-y-5">
            <div className="flex items-center justify-between mb-1">
                <div className="label-caption">Before / After</div>
                <button
                    onClick={onAccept}
                    disabled={saving || !hasChanges}
                    className="text-xs font-black uppercase tracking-widest px-3 py-1.5 bg-emerald-600 text-black rounded-sm hover:bg-emerald-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving…' : 'Accept Changes'}
                </button>
            </div>

            <div className="space-y-1">
                <div className="text-xs text-zinc-600 uppercase tracking-widest">Expected CAGR</div>
                <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-black text-zinc-400 tabular-nums">{(origCagr * 100).toFixed(1)}%</span>
                    <span className="text-zinc-700 text-[11px]">→</span>
                    <span className="text-[13px] font-black text-zinc-200 tabular-nums">{(draftCagr * 100).toFixed(1)}%</span>
                    <Delta before={origCagr} after={draftCagr} />
                </div>
            </div>

            <div className="space-y-1">
                <div className="text-xs text-zinc-600 uppercase tracking-widest">Stock Allocation</div>
                <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-black text-zinc-400 tabular-nums">{(origStock * 100).toFixed(0)}%</span>
                    <span className="text-zinc-700 text-[11px]">→</span>
                    <span className="text-[13px] font-black text-zinc-200 tabular-nums">{(draftStock * 100).toFixed(0)}%</span>
                    <Delta before={origStock} after={draftStock} />
                </div>
            </div>

            <div className="border-t border-zinc-900 pt-4 space-y-1">
                <div className="text-xs text-zinc-600 uppercase tracking-widest">Top-level sum</div>
                <div className={`text-[13px] font-black tabular-nums ${sumOk ? 'text-emerald-400' : 'text-amber-500'}`}>
                    {(topLevelSum * 100).toFixed(1)}%
                    {!sumOk && <span className="text-xs font-bold ml-2">⚠ must equal 100%</span>}
                </div>
            </div>
        </div>
    );
}
