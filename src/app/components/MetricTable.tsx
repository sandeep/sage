'use client';
// src/app/components/MetricTable.tsx
import React, { useState } from 'react';
import { MetricRow } from '../../lib/logic/xray';
import { usePrivacy } from './PrivacyContext';
import TickerHoverCard from './TickerHoverCard';

const fmtPct = (val: number) => (val * 100).toFixed(1) + '%';
const fmtUSD = (val: number) => {
    if (val >= 1_000_000) return '$' + (val / 1_000_000).toFixed(2) + 'M';
    if (val >= 1_000) return '$' + (val / 1_000).toFixed(1) + 'k';
    return '$' + val.toFixed(0);
};

export default function MetricTable({ metrics }: { metrics: MetricRow[] }) {
    const { privacy } = usePrivacy();
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set(metrics.map(m => m.label)));
    const [hoveredContributor, setHoveredContributor] = useState<any | null>(null);

    const totalRow = metrics.find(m => m.label === 'Total Portfolio');
    const totalValue = totalRow?.actualValue || 1;

    const toggleRow = (label: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(label)) {
                next.delete(label);
                const nodeIdx = metrics.findIndex(m => m.label === label);
                if (nodeIdx !== -1) {
                    const node = metrics[nodeIdx];
                    for (let i = nodeIdx + 1; i < metrics.length; i++) {
                        if (metrics[i].level > node.level) next.delete(metrics[i].label);
                        else break;
                    }
                }
            } else {
                next.add(label);
            }
            return next;
        });
    };

    const isRowVisible = (m: MetricRow): boolean => {
        if (m.level === -1 || m.level === 0) return true;
        const parent = metrics.find(p => p.level === m.level - 1 && metrics.indexOf(p) < metrics.indexOf(m));
        if (!parent) return false;
        return expandedRows.has(parent.label) && isRowVisible(parent);
    };

    const visibleRows = metrics.filter(m => m.level !== -1 && isRowVisible(m));

    return (
        <div className="overflow-x-auto bg-black font-mono w-full rounded-sm border border-zinc-900 shadow-2xl">
            {hoveredContributor && !privacy && (
                <TickerHoverCard {...hoveredContributor} />
            )}
            <table className="border-collapse w-full table-fixed">
                <thead>
                    <tr className="text-ui-label text-zinc-500 uppercase tracking-widest border-b border-zinc-900 bg-zinc-950 px-10">
                        <th className="py-6 pr-2 pl-10 text-left font-black w-[45%]">Asset Class</th>
                        <th className="py-6 px-3 text-right text-white font-black w-[22%]">Actual ($ / %)</th>
                        <th className="py-6 px-3 text-right text-zinc-500 font-black w-[22%]">Target ($ / %)</th>
                        <th className="py-6 pl-3 pr-10 text-right text-zinc-500 font-black w-[11%]">Drift</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/50">
                    {visibleRows.map((m, idx) => {
                        const drift = m.actualPortfolio - m.expectedPortfolio;
                        const isExpanded = expandedRows.has(m.label);
                        const originalIdx = metrics.indexOf(m);
                        const nextMetric = metrics[originalIdx + 1];
                        const isParent = nextMetric ? nextMetric.level > m.level : false;
                        const hasContributors = !!(m.contributors && m.contributors.length > 0);
                        const showInstruments = isExpanded && !isParent && hasContributors;

                        return (
                            <React.Fragment key={m.label + idx}>
                                <tr
                                    className={`transition-colors outline-none cursor-pointer hover:bg-zinc-900/40 ${m.level === 0 ? 'bg-zinc-900/10' : ''}`}
                                    onClick={() => (isParent || hasContributors) && toggleRow(m.label)}
                                >
                                    <td className={`py-5 pr-2 whitespace-nowrap font-black flex items-center gap-3 ${
                                        m.level === 0 ? 'text-zinc-100 pl-10 text-ui-header' :
                                        m.level === 1 ? 'text-zinc-300 pl-16 text-ui-body' :
                                        'text-zinc-500 pl-20 text-ui-body font-medium'
                                    }`}>
                                        <span className="text-ui-caption w-2 text-zinc-700">
                                            {(isParent || hasContributors) ? (isExpanded ? '▼' : '▶') : ''}
                                        </span>
                                        {m.label}
                                    </td>
                                    <td className="py-5 px-3 text-right text-white font-bold text-ui-body tabular-nums">
                                        {privacy ? '•••' : fmtUSD(m.actualValue)}
                                        <span className="text-ui-caption ml-2 opacity-40">({fmtPct(m.actualPortfolio)})</span>
                                    </td>
                                    <td className="py-5 px-3 text-right text-zinc-600 font-bold text-ui-body tabular-nums">
                                        {privacy ? '•••' : fmtUSD(m.expectedPortfolio * totalValue)}
                                        <span className="text-ui-caption ml-2 opacity-40">({fmtPct(m.expectedPortfolio)})</span>
                                    </td>
                                    <td className={`py-5 pl-3 pr-10 text-right font-black text-ui-body tabular-nums ${
                                        drift > 0.02 ? 'text-emerald-500' : drift < -0.02 ? 'text-rose-500' : 'text-zinc-800'
                                    }`}>
                                        {drift > 0 ? '+' : ''}{(drift * 100).toFixed(1)}%
                                    </td>
                                </tr>

                                {showInstruments && m.contributors && m.contributors.map((c, ci) => {
                                    return (
                                        <tr key={`${m.label}-c-${ci}`} className="bg-zinc-900/20 border-none group tabular-nums">
                                            <td 
                                                className="pl-24 pr-2 py-3 text-zinc-100 font-bold text-ui-body cursor-help"
                                                onMouseEnter={(e) => setHoveredContributor({ contributor: c, x: e.clientX, y: e.clientY })}
                                                onMouseLeave={() => setHoveredContributor(null)}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span className="text-white font-black shrink-0">{c.ticker}</span>
                                                    <span className="text-ui-caption text-zinc-600 truncate group-hover:text-emerald-500 transition-colors">
                                                        {c.accounts?.map(a => a.accountName).join(' | ')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-right text-zinc-300 font-bold text-ui-body tabular-nums">
                                                {privacy ? '•••' : fmtUSD(c.value)}
                                                <span className="ml-2 opacity-30 text-ui-caption">({fmtPct(c.pct)})</span>
                                            </td>
                                            <td className="py-3 px-3 text-right text-zinc-900">—</td>
                                            <td className="py-3 pl-3 pr-10 text-right text-zinc-900">—</td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
