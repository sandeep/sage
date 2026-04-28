'use client';

import AllocationSlider from '../AllocationSlider';

interface AllocationNodeRowProps {
    topLabel: string;
    topNode: any;
    actualWeights: Record<string, number>;
    isOpen: boolean;
    onToggleOpen: () => void;
    onSliderChange: (label: string, weight: number) => void;
    onTopLevelSliderChange: (label: string, weight: number) => void;
}

const ACCENT: Record<string, string> = {
    Stock: 'text-emerald-400',
    Bond:  'text-indigo-400',
    Cash:  'text-zinc-500',
};

export default function AllocationNodeRow({
    topLabel,
    topNode,
    actualWeights,
    isOpen,
    onToggleOpen,
    onSliderChange,
    onTopLevelSliderChange
}: AllocationNodeRowProps) {
    const accentClass = ACCENT[topLabel] ?? 'text-zinc-400';
    const cats: [string, any][] = Object.entries(topNode.categories ?? {});

    const renderSubcategorySection = (catLabel: string, catNode: any) => {
        const subs: [string, any][] = Object.entries(catNode.subcategories ?? {});
        if (subs.length === 0) return null;
        return (
            <div key={catLabel} className="border-t border-zinc-900 bg-zinc-900/10">
                <div className="flex justify-between items-center px-10 py-4">
                    <div className="flex items-baseline gap-3">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{catLabel}</span>
                        <span className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">(Actual: {((actualWeights[catLabel] || 0) * 100).toFixed(1)}%)</span>
                    </div>
                    <span className="text-sm font-black text-zinc-300 tabular-nums">
                        {(catNode.weight * 100).toFixed(1)}%
                    </span>
                </div>
                <div className="px-10 pb-6 space-y-1">
                    {subs.map(([subLabel, subNode]) => (
                        <AllocationSlider 
                            key={subLabel} 
                            label={subLabel} 
                            weight={subNode.weight}
                            actualWeight={actualWeights[subLabel]}
                            categoryWeight={catNode.weight} 
                            dimmed={subNode.weight === 0}
                            onChange={w => onSliderChange(subLabel, w)} 
                        />
                    ))}
                </div>
            </div>
        );
    };

    const renderBondLeafSection = (catLabel: string, catNode: any, bondTopWeight: number) => {
        return (
            <div key={catLabel} className="border-t border-zinc-900 bg-zinc-900/10 px-10 py-6">
                <AllocationSlider 
                    label={catLabel} 
                    weight={catNode.weight}
                    actualWeight={actualWeights[catLabel]}
                    categoryWeight={bondTopWeight} 
                    dimmed={catNode.weight === 0}
                    onChange={w => onSliderChange(catLabel, w)} 
                />
            </div>
        );
    };

    return (
        <div key={topLabel} className="bg-zinc-950 border border-zinc-900 rounded-sm overflow-hidden mb-6 shadow-xl">
            <div
                className="flex justify-between items-center px-10 py-6 bg-zinc-900/20 cursor-pointer select-none group"
                onClick={onToggleOpen}
            >
                <div className="flex items-center gap-4">
                    <span className="text-zinc-700 text-[10px] font-black group-hover:text-zinc-400 transition-colors">{isOpen ? '▼' : '▶'}</span>
                    <div className="flex flex-col">
                        <span className="text-lg font-black text-zinc-100 uppercase tracking-tighter">{topLabel}</span>
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Target Asset Class</span>
                    </div>
                </div>
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Actual</div>
                            <div className="text-sm font-black text-zinc-500 tabular-nums">{((actualWeights[topLabel] || 0) * 100).toFixed(1)}%</div>
                        </div>
                        <input type="range" min={0} max={1} step={0.005} value={topNode.weight}
                            onChange={e => onTopLevelSliderChange(topLabel, parseFloat(e.target.value))}
                            className="w-32 h-1 accent-emerald-500 cursor-pointer"
                            onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} />
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Target</div>
                        <div className={`text-2xl font-black tabular-nums tracking-tighter ${accentClass}`}>
                            {(topNode.weight * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    {cats.map(([catLabel, catNode]) =>
                        catNode.subcategories
                            ? renderSubcategorySection(catLabel, catNode)
                            : renderBondLeafSection(catLabel, catNode, topNode.weight)
                    )}
                </div>
            )}
        </div>
    );
}
