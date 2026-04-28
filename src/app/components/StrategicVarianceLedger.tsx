'use client';
import React from 'react';
import { usePrivacy } from './PrivacyContext';
import { LeakageRow } from '@/lib/types/audit';

interface Props {
    ledger: LeakageRow[];
    totalLeakage: number;
}

export default function StrategicVarianceLedger({ ledger, totalLeakage }: Props) {
    const { privacy } = usePrivacy();

    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
    const dollar = (n: number | null) => {
        if (n == null) return '—';
        return privacy
            ? <span className="opacity-20 italic font-medium tracking-tighter text-zinc-500">$ **,***</span>
            : <span>${Math.round(Math.abs(n)).toLocaleString()}</span>;
    };

    return (
        <div id="zone-leakage-ledger" className="space-y-12">
            <div className="bg-zinc-950 border border-zinc-900 rounded-sm overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse font-mono">
                    <thead>
                        <tr className="ui-label border-b border-zinc-900 bg-zinc-900/40">
                            <th className="px-10 py-8">Source of Leakage</th>
                            <th className="px-10 py-8 border-l border-zinc-900">Under/Over Target Δ</th>
                            <th className="px-10 py-8 border-l border-zinc-900">Market Return (1Y)</th>
                            <th className="px-10 py-8 text-right border-l border-zinc-900 text-rose-500">Dollar Impact</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/50">
                        {ledger.map((row, idx) => {
                            const isMissing = row.weight < 0;
                            return (
                                <tr key={idx} className="hover:bg-zinc-900/10 transition-colors group">
                                    <td className="px-10 py-8 font-black text-zinc-100 uppercase tracking-tight text-base">{row.label}</td>
                                    <td className={`px-10 py-8 border-l border-zinc-900 font-bold text-sm ${isMissing ? 'text-rose-400' : 'text-amber-400'}`}>
                                        {isMissing ? 'MISSING' : 'EXCESS'} {Math.abs(row.weight * 100).toFixed(1)}%
                                    </td>
                                    <td className="px-10 py-8 border-l border-zinc-900 font-bold text-zinc-500 tabular-nums">
                                        {row.marketReturn !== 0 ? `+${fmtPct(row.marketReturn)}` : '0.0%'}
                                    </td>
                                    <td className="px-10 py-8 text-right border-l border-zinc-900 font-black text-rose-400 ui-metric">
                                        -{dollar(row.dollarImpact)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-rose-950/5 border-t-2 border-zinc-800">
                            <td colSpan={3} className="px-10 py-12 ui-label text-zinc-100">
                                Total Alpha Leakage (Reconciled)
                            </td>
                            <td className="px-10 py-12 text-right font-black text-rose-500 ui-hero tabular-nums border-l border-zinc-800/50 tracking-tighter" style={{ fontStyle: 'normal' }}>
                                -{dollar(totalLeakage)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="ui-value text-zinc-500 leading-relaxed border-l-4 border-rose-900/30 pl-10 py-4 max-w-5xl italic">
                This ledger reconciles the <span className="text-zinc-200 font-bold">{dollar(totalLeakage)}</span> performance gap. 
                The largest hit is the <span className="text-zinc-200 font-bold uppercase tracking-tighter not-italic">Cash Trap</span>, representing the missed growth opportunity of sitting in 
                non-earning assets while your strategy&apos;s risk-equivalents rallied.
            </div>
        </div>
    );
}
