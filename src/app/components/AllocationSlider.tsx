'use client';
import React from 'react';

export default function AllocationSlider({
    label,
    weight,
    actualWeight,
    categoryWeight,
    dimmed = false,
    onChange,
}: {
    label: string;
    weight: number;
    actualWeight?: number;
    categoryWeight: number;
    dimmed?: boolean;
    onChange: (newWeight: number) => void;
}) {
    const pctOfSection = weight === 0
        ? '—'
        : categoryWeight > 0
            ? `${(weight / categoryWeight * 100).toFixed(1)}%`
            : '—';
    const pctTotal = `${(weight * 100).toFixed(1)}%`;
    const pctActual = actualWeight !== undefined ? `${(actualWeight * 100).toFixed(1)}%` : null;

    return (
        <div
            className="flex items-center gap-3 py-2 group"
            style={{ opacity: dimmed ? 0.32 : 1 }}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-bold text-zinc-100 uppercase tracking-tight truncate" title={label}>
                        {label}
                    </span>
                    {pctActual && (
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                            (Actual: {pctActual})
                        </span>
                    )}
                </div>
            </div>
            
            <input
                type="range"
                min={0}
                max={categoryWeight}
                step={0.005}
                value={weight}
                onChange={e => onChange(parseFloat(e.target.value))}
                className="w-24 h-1 accent-emerald-500 cursor-pointer"
            />
            
            <div className="flex divide-x divide-zinc-900 w-24">
                <span className="text-[10px] text-zinc-500 tabular-nums flex-1 text-right pr-3 font-bold">
                    {pctOfSection}
                </span>
                <span className="text-[12px] font-black text-emerald-400 tabular-nums flex-1 text-right pl-3 tracking-tighter">
                    {pctTotal}
                </span>
            </div>
        </div>
    );
}
