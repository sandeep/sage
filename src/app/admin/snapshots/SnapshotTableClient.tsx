'use client';
import React, { useState } from 'react';
import type { SnapshotRow, SnapshotExpansion } from '@/lib/logic/snapshotBrowser';

function formatDate(date: string): string {
    const [year, month] = date.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(month) - 1]} ${year}`;
}

function fmtUSD(v: number): string {
    return `$${Math.round(v).toLocaleString()}`;
}

function fmtPct(v: number): string {
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

function DriftBadge({ score }: { score: number }) {
    const pct = (score * 100).toFixed(1);
    const color = score < 0.03 ? 'text-emerald-400' : score < 0.06 ? 'text-amber-400' : 'text-rose-400';
    return <span className={`font-mono font-black ${color}`}>{pct}%</span>;
}

function MixBar({ stockPct, bondPct, cashPct }: { stockPct: number; bondPct: number; cashPct: number }) {
    return (
        <div className="flex items-center gap-2">
            <div className="flex h-2 w-16 overflow-hidden rounded-sm bg-zinc-900">
                <div className="bg-emerald-500" style={{ width: `${stockPct}%` }} />
                <div className="bg-blue-500" style={{ width: `${bondPct}%` }} />
                <div className="bg-zinc-600" style={{ width: `${cashPct}%` }} />
            </div>
            <span className="ui-caption text-zinc-500">{stockPct}/{bondPct}/{cashPct}</span>
        </div>
    );
}

interface Props {
    rows: SnapshotRow[];
    expansions: Record<string, SnapshotExpansion>;
}

export default function SnapshotTableClient({ rows, expansions }: Props) {
    const [openDate, setOpenDate] = useState<string | null>(null);
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [labels, setLabels] = useState<Record<string, string | null>>(
        Object.fromEntries(rows.map(r => [r.snapshotDate, r.label]))
    );

    const saveLabel = async (date: string) => {
        const trimmed = editValue.trim() || null;
        const prev = labels[date] ?? null;
        setLabels(l => ({ ...l, [date]: trimmed }));
        setEditingDate(null);
        try {
            const res = await fetch(`/api/admin/snapshots/${date}/label`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: trimmed }),
            });
            if (!res.ok) throw new Error('save failed');
        } catch {
            setLabels(l => ({ ...l, [date]: prev }));
        }
    };

    return (
        <div className="w-full border border-zinc-900 rounded-sm overflow-x-auto font-mono bg-black shadow-2xl">
            <table className="w-full border-collapse text-left min-w-[900px]">
                <thead>
                    <tr className="ui-label border-b border-zinc-900 bg-zinc-900/30">
                        <th className="px-10 py-4 w-[120px]">Date</th>
                        <th className="px-10 py-4 w-[160px]">Label</th>
                        <th className="px-10 py-4 w-[140px] text-right">Total Value</th>
                        <th className="px-10 py-4 w-[150px] text-right">Δ Growth</th>
                        <th className="px-10 py-4 w-[180px]">Allocation Mix</th>
                        <th className="px-10 py-4 w-[100px]">Drift</th>
                        <th className="px-10 py-4 w-[100px] text-right">Assets</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const isOpen = openDate === row.snapshotDate;
                        const isEditing = editingDate === row.snapshotDate;
                        const exp = expansions[row.snapshotDate];

                        return (
                            <React.Fragment key={row.snapshotDate}>
                                <tr
                                    className="border-b border-zinc-900/50 hover:bg-zinc-900/20 cursor-pointer transition-colors"
                                    onClick={() => setOpenDate(isOpen ? null : row.snapshotDate)}
                                >
                                    <td className="px-10 py-5 ui-value !text-zinc-200">{formatDate(row.snapshotDate)}</td>
                                    <td className="px-10 py-5" onClick={e => e.stopPropagation()}>
                                        {isEditing ? (
                                            <input
                                                autoFocus
                                                className="bg-zinc-900 border border-zinc-700 text-white text-[11px] px-2 py-1 rounded-sm w-full font-mono focus:border-accent outline-none"
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onBlur={() => saveLabel(row.snapshotDate)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveLabel(row.snapshotDate); if (e.key === 'Escape') setEditingDate(null); }}
                                            />
                                        ) : (
                                            <span
                                                className="ui-caption text-zinc-500 hover:text-zinc-300 cursor-text italic border-b border-dotted border-zinc-800"
                                                onClick={() => { setEditingDate(row.snapshotDate); setEditValue(labels[row.snapshotDate] ?? ''); }}
                                            >
                                                {labels[row.snapshotDate] ?? '—'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-10 py-5 ui-value text-right text-zinc-100">{fmtUSD(row.totalValue)}</td>
                                    <td className="px-10 py-5 text-right">
                                        {row.growthDollars !== null ? (
                                            <div className="flex flex-col items-end">
                                                <span className={`ui-value font-bold ${row.growthDollars >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {row.growthDollars >= 0 ? '+' : ''}{fmtUSD(row.growthDollars)}
                                                </span>
                                                <span className="text-[9px] font-black text-zinc-600 tracking-widest">{fmtPct(row.growthPct!)}</span>
                                            </div>
                                        ) : (
                                            <span className="ui-caption text-zinc-700 italic">baseline</span>
                                        )}
                                    </td>
                                    <td className="px-10 py-5"><MixBar {...row.mix} /></td>
                                    <td className="px-10 py-5"><DriftBadge score={row.driftScore} /></td>
                                    <td className="px-10 py-5 ui-value text-right text-zinc-400">{row.positionCount}</td>
                                </tr>
                                {isOpen && exp && (
                                    <tr className="border-b border-zinc-900 bg-zinc-950/50">
                                        <td colSpan={7} className="px-10 py-10">
                                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
                                                {/* Holdings */}
                                                <div className="space-y-4">
                                                    <div className="text-ui-label !text-zinc-500 pb-2 border-b border-zinc-900">Current Positions</div>
                                                    <table className="w-full text-[11px] font-mono">
                                                        <thead><tr className="ui-caption text-zinc-600"><th className="text-left pb-2">Ticker</th><th className="text-right pb-2">Market Value</th><th className="text-right pb-2">Weight</th></tr></thead>
                                                        <tbody className="divide-y divide-zinc-900/30">
                                                            {exp.holdings.slice(0, 10).map(h => (
                                                                <tr key={h.ticker} className="group hover:bg-zinc-900/10">
                                                                    <td className="py-2 text-zinc-300 font-bold uppercase">{h.ticker}</td>
                                                                    <td className="py-2 text-right text-zinc-400">{fmtUSD(h.marketValue)}</td>
                                                                    <td className="py-2 text-right text-zinc-500 font-bold">{h.weightPct.toFixed(1)}%</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Movers */}
                                                <div className="space-y-4">
                                                    <div className="text-ui-label !text-zinc-500 pb-2 border-b border-zinc-900">Relative Movers</div>
                                                    {exp.movers.length === 0 ? (
                                                        <p className="ui-caption text-zinc-700 italic pt-2">Baseline snapshot — no previous to compare</p>
                                                    ) : (
                                                        <table className="w-full text-[11px] font-mono">
                                                            <thead><tr className="ui-caption text-zinc-600"><th className="text-left pb-2">Ticker</th><th className="text-right pb-2">Prev</th><th className="text-right pb-2">Now</th><th className="text-right pb-2">Δ</th></tr></thead>
                                                            <tbody className="divide-y divide-zinc-900/30">
                                                                {exp.movers.map(m => (
                                                                    <tr key={m.ticker} className="group hover:bg-zinc-900/10">
                                                                        <td className="py-2 text-zinc-300 font-bold uppercase">{m.ticker}</td>
                                                                        <td className="py-2 text-right text-zinc-600">{m.prevWeightPct.toFixed(1)}%</td>
                                                                        <td className="py-2 text-right text-zinc-400">{m.currWeightPct.toFixed(1)}%</td>
                                                                        <td className={`py-2 text-right font-black ${m.deltaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{m.deltaPct >= 0 ? '+' : ''}{m.deltaPct.toFixed(1)}%</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>

                                                {/* Drift Table */}
                                                <div className="space-y-4">
                                                    <div className="text-ui-label !text-zinc-500 pb-2 border-b border-zinc-900">Category Drift</div>
                                                    <table className="w-full text-[11px] font-mono">
                                                        <thead><tr className="ui-caption text-zinc-600"><th className="text-left pb-2">Asset Class</th><th className="text-right pb-2">Target</th><th className="text-right pb-2">Actual</th><th className="text-right pb-2">Δ</th></tr></thead>
                                                        <tbody className="divide-y divide-zinc-900/30">
                                                            {exp.driftTable.slice(0, 8).map(d => (
                                                                <tr key={d.label} className="group hover:bg-zinc-900/10">
                                                                    <td className="py-2 text-zinc-400">{d.label}</td>
                                                                    <td className="py-2 text-right text-zinc-600">{d.targetPct.toFixed(1)}%</td>
                                                                    <td className="py-2 text-right text-zinc-400">{d.actualPct.toFixed(1)}%</td>
                                                                    <td className={`py-2 text-right font-black ${Math.abs(d.deltaPct) < 2 ? 'text-zinc-500' : d.deltaPct > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{d.deltaPct >= 0 ? '+' : ''}{d.deltaPct.toFixed(1)}%</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
