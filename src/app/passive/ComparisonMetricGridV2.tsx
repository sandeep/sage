'use client';
import React from 'react';

export default function ComparisonMetricGridV2({ actual, target, dataNote }: {
    actual: any | null,
    target: any | null,
    dataNote: string | null
}) {
    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
    const fmtNum = (v: number) => v.toFixed(2);

    const metrics = [
        { label: "Annualized Return (CAGR)", actualVal: actual?.annualizedReturn, targetVal: target?.annualizedReturn, format: fmtPct, colorActual: "text-risk", colorTarget: "text-accent" },
        { label: "Annualized Volatility", actualVal: actual?.volatility, targetVal: target?.volatility, format: fmtPct, colorActual: "text-truth", colorTarget: "text-truth" },
        { label: "Sharpe Ratio (Rf 5.0%)", actualVal: actual?.sharpe, targetVal: target?.sharpe, format: fmtNum, colorActual: "text-risk", colorTarget: "text-accent" },
        { label: "M2 / Sortino II", actualVal: actual?.m2, targetVal: target?.m2, format: fmtNum, colorActual: "text-risk", colorTarget: "text-accent" },
        { label: "Max Drawdown", actualVal: actual?.maxDrawdown, targetVal: target?.maxDrawdown, format: fmtPct, colorActual: "text-risk", colorTarget: "text-risk" },
        { label: "Ulcer Index (Severity)", actualVal: actual?.ulcer, targetVal: target?.ulcer, format: fmtNum, colorActual: "text-risk", colorTarget: "text-risk" },
    ];

    return (
        <div className="w-full">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-zinc-900/50">
                        <th className="px-10 py-5 text-left ui-caption">Metric</th>
                        <th className="px-10 py-5 text-right ui-caption text-risk">Actual (Sim)</th>
                        <th className="px-10 py-5 text-right ui-caption text-accent">Strategy</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/50">
                    {metrics.map((m, idx) => (
                        <tr key={idx} className="group hover:bg-white/5 transition-colors">
                            <td className="px-10 py-5 ui-label text-truth group-hover:text-white transition-colors">
                                {m.label}
                            </td>
                            <td className={`px-10 py-5 text-right ui-value font-bold ${m.colorActual}`}>
                                {m.actualVal !== undefined && m.actualVal !== null ? m.format(m.actualVal) : '—'}
                            </td>
                            <td className={`px-10 py-5 text-right ui-value font-bold ${m.colorTarget}`}>
                                {m.targetVal !== undefined && m.targetVal !== null ? m.format(m.targetVal) : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            {dataNote && (
                <div className="ui-caption italic leading-relaxed px-10 pt-8 flex gap-4">
                    <span className="text-amber-500 font-black">Note:</span>
                    <span>{dataNote}</span>
                </div>
            )}
        </div>
    );
}
