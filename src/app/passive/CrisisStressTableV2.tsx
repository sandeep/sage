'use client';
import React from 'react';

interface CrisisRow {
    name: string;
    years: number[];
    vti: number | null;
    target: number | null;
    actual: number | null;
}

const CRISIS_LABELS: Record<string, string> = {
    'Stagflation': 'High Inflation & Rates',
    'Black Monday': 'Liquidity Shock',
    'Dot-com': 'Tech Bubble Burst',
    'GFC': 'Systemic Collapse',
    'Inflation Surge': 'Bond/Stock Correlation'
};

export default function CrisisStressTableV2({ crisisData, totalValue }: {
    crisisData: CrisisRow[];
    totalValue: number;
}) {
    if (!crisisData || crisisData.length === 0) return null;

    const dollar = (pct: number | null) => {
        if (pct === null) return '—';
        const amount = Math.abs(pct * totalValue);
        if (amount >= 1000) return `$${Math.round(amount / 1000).toLocaleString()}k`;
        return `$${Math.round(amount).toLocaleString()}`;
    };

    const pct = (v: number | null, colorClass: string = "text-white") => (
        v !== null 
            ? <span className={`ui-value font-bold ${colorClass}`}>{(v * 100).toFixed(1)}%</span> 
            : <span className="ui-value text-zinc-dim">—</span>
    );

    return (
        <div className="space-y-10">
            <div className="bg-black border border-zinc-900 rounded-sm overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="ui-label border-b border-zinc-900 bg-zinc-900/30">
                            <th className="px-10 py-4 w-[260px]">Crisis Event</th>
                            <th className="px-10 py-4 text-right border-l border-zinc-900/50 text-truth">VTI (Market)</th>
                            <th className="px-10 py-4 text-right border-l border-zinc-900/50 text-risk">Actual</th>
                            <th className="px-10 py-4 text-right border-l border-zinc-900/50 text-accent">Strategy</th>
                            <th className="px-10 py-4 text-right border-l border-zinc-900/50 text-risk bg-risk/5 w-[300px]">
                                Addl. Capital at Risk
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/50">
                        {crisisData.map(row => {
                            const resilienceDelta = (row.target != null && row.actual != null) ? (row.actual - row.target) : 0;
                            const isAtRisk = resilienceDelta > 0;

                            return (
                                <tr key={row.name} className="hover:bg-zinc-900/20 transition-colors group">
                                    <td className="px-10 py-5">
                                        <div className="ui-label text-zinc-200 italic">{row.name}</div>
                                        <div className="ui-caption mt-1 font-bold tracking-widest">
                                            {CRISIS_LABELS[row.name] || 'Regime'} &middot; {row.years[0]}{row.years.length > 1 ? `–${row.years[row.years.length - 1]}` : ''}
                                        </div>
                                    </td>
                                    <td className="px-10 py-5 text-right border-l border-zinc-900/50">
                                        {pct(row.vti, "text-truth")}
                                    </td>
                                    <td className="px-10 py-5 text-right border-l border-zinc-900/50">
                                        {pct(row.actual, "text-risk")}
                                    </td>
                                    <td className="px-10 py-5 text-right border-l border-zinc-900/50">
                                        {pct(row.target, "text-accent")}
                                    </td>
                                    <td className={`px-10 py-5 text-right border-l border-zinc-900/50 bg-risk/5`}>
                                        {isAtRisk ? (
                                            <div className="ui-value text-risk font-bold tabular-nums">
                                                +{dollar(resilienceDelta)}
                                            </div>
                                        ) : (
                                            <div className="ui-value text-zinc-dim">—</div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
