'use client';
import React from 'react';
import { usePrivacy } from './PrivacyContext';

export interface HorizonResult {
    horizon: string;
    isProxy: boolean;
    marketReturn: number;
    marketSharpe: number;
    targetReturn: number;
    targetSharpe: number;
    targetM2VsVti: number;
    targetAlphaVsVti: number;
    targetCapture: [number, number] | null;
    portfolioReturn: number;
    portfolioSharpe: number;
    portfolioM2VsVti: number;
    portfolioAlphaVsVti: number;
    portfolioCapture: [number, number] | null;
    m2DeltaVsTarget: number;
    annualDollarLoss: number;
}

interface Props {
    data: HorizonResult[];
}

export default function PerformanceGrid({ data }: Props) {
    const { privacy } = usePrivacy();

    const fmtPct = (v: number | null) => v !== null ? `${(v * 100).toFixed(1)}%` : '—';
    const fmtNum = (v: number | null) => v !== null ? v.toFixed(2) : '—';
    const fmtUSD = (v: number | null) => v !== null ? `$${Math.round(Math.abs(v) / 1000).toLocaleString()}k` : '—';

    const dollarMask = (v: number | null) => {
        if (v === null) return '—';
        return privacy ? <span className="opacity-20 italic font-medium tracking-tighter text-meta">$ **,***</span> : (v > 0 ? '-' : '') + fmtUSD(v);
    };

    return (
        <div className="w-full bg-black border border-border rounded-sm overflow-x-auto font-mono shadow-2xl">
            <table className="w-full border-collapse text-left min-w-[1200px] table-fixed">
                <thead>
                    <tr className="ui-label border-b border-border bg-card">
                        <th className="px-4 py-4 border-r border-border w-[140px] text-white italic">Horizon</th>
                        <th className="px-4 py-4 w-[120px] text-white">1. Market</th>
                        <th colSpan={3} className="px-4 py-4 text-center border-l border-border text-accent bg-accent/5">2. Strategy Potential</th>
                        <th colSpan={3} className="px-4 py-4 text-center border-l border-border text-white bg-white/5">3. Portfolio Realization</th>
                        <th colSpan={2} className="px-4 py-4 text-center border-l border-border text-risk bg-risk/5">4. Execution Gap</th>
                    </tr>
                    <tr className="ui-caption border-b border-border">
                        <th className="px-4 py-3 border-r border-border">Period</th>
                        <th className="px-4 py-3 whitespace-nowrap">Nom | Sharpe</th>
                        <th className="px-4 py-3 border-l border-border whitespace-nowrap bg-accent/5">Nom | Sharpe</th>
                        <th className="px-4 py-3 whitespace-nowrap bg-accent/5 text-center">M2 Δ | Alpha</th>
                        <th className="px-4 py-3 whitespace-nowrap bg-accent/5 text-right pr-4">Cap (U/D)</th>
                        <th className="px-4 py-3 border-l border-border whitespace-nowrap bg-white/5">Nom | Sharpe</th>
                        <th className="px-4 py-3 whitespace-nowrap bg-white/5 text-center">M2 Δ | Alpha</th>
                        <th className="px-4 py-3 whitespace-nowrap bg-white/5 text-right pr-4">Cap (U/D)</th>
                        <th className="px-4 py-3 border-l border-border whitespace-nowrap bg-risk/5 text-center">M2 Δ (Δ)</th>
                        <th className="px-4 py-3 text-right bg-risk/5 whitespace-nowrap pr-4">Annual $ Loss</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                    {data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors group">
                            <td className="px-4 py-3 border-r border-border whitespace-nowrap">
                                <div className="ui-label text-white italic tracking-tighter">{row.horizon}</div>
                                {row.isProxy && (
                                    <div className="relative inline-block group/tip">
                                        <div className="ui-caption text-meta mt-0.5 cursor-help border-b border-dotted border-meta">Cycle Sim</div>
                                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tip:block w-64 bg-card border border-border p-3 shadow-2xl z-50 rounded-sm">
                                            <div className="ui-label text-accent mb-1">Institutional Proxy Model</div>
                                            <p className="ui-caption leading-relaxed text-truth font-normal lowercase normal-case">
                                                Uses 50 years of Simba asset class proxies anchored to your target weights. Required for horizons where daily pricing is unavailable.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </td>
                            {/* Market */}
                            <td className="px-4 py-3 whitespace-nowrap ui-value text-truth font-bold">
                                {fmtPct(row.marketReturn)} <span className="mx-0.5 text-meta opacity-40">|</span> {fmtNum(row.marketSharpe)}
                            </td>
                            {/* Strategy */}
                            <td className="px-4 py-3 border-l border-border bg-accent/5 text-accent whitespace-nowrap ui-value font-bold">
                                {fmtPct(row.targetReturn)} <span className="mx-0.5 text-meta opacity-40">|</span> {fmtNum(row.targetSharpe)}
                            </td>
                            <td className="px-4 py-3 bg-accent/5 text-center whitespace-nowrap ui-value font-bold">
                                <span className={row.targetM2VsVti < 0 ? 'text-risk' : 'text-accent'}>
                                    {row.targetM2VsVti > 0 ? '+' : ''}{fmtPct(row.targetM2VsVti)}
                                </span>
                                <span className="mx-1 text-meta opacity-40">|</span>
                                <span className={row.targetAlphaVsVti < 0 ? 'text-risk' : 'text-accent'}>
                                    {row.targetAlphaVsVti > 0 ? '+' : ''}{fmtPct(row.targetAlphaVsVti)}
                                </span>
                            </td>
                            <td className="px-4 py-3 ui-caption font-bold text-right text-meta bg-accent/5 whitespace-nowrap pr-4">
                                {row.targetCapture ? `${fmtPct(row.targetCapture[0])} / ${fmtPct(row.targetCapture[1])}` : '—'}
                            </td>
                            {/* Portfolio */}
                            <td className="px-4 py-3 border-l border-border bg-white/5 text-white whitespace-nowrap ui-value font-bold">
                                {fmtPct(row.portfolioReturn)} <span className="mx-0.5 text-meta opacity-40">|</span> {fmtNum(row.portfolioSharpe)}
                            </td>
                            <td className="px-4 py-3 bg-white/5 text-center whitespace-nowrap ui-value font-bold">
                                <span className={row.portfolioM2VsVti < 0 ? 'text-risk' : 'text-accent'}>
                                    {row.portfolioM2VsVti > 0 ? '+' : ''}{fmtPct(row.portfolioM2VsVti)}
                                </span>
                                <span className="mx-1 text-meta opacity-40">|</span>
                                <span className={row.portfolioAlphaVsVti < 0 ? 'text-risk' : 'text-accent'}>
                                    {row.portfolioAlphaVsVti > 0 ? '+' : ''}{fmtPct(row.portfolioAlphaVsVti)}
                                </span>
                            </td>
                            <td className="px-4 py-3 ui-caption font-bold text-right text-meta bg-white/5 whitespace-nowrap pr-4">
                                {row.portfolioCapture ? `${fmtPct(row.portfolioCapture[0])} / ${fmtPct(row.portfolioCapture[1])}` : '—'}
                            </td>
                            {/* Audit */}
                            <td className="px-4 py-3 border-l border-border bg-risk/5 text-center whitespace-nowrap ui-metric">
                                <span className={row.m2DeltaVsTarget < 0 ? 'text-risk' : 'text-accent'}>
                                    {row.m2DeltaVsTarget > 0 ? '+' : ''}{fmtPct(row.m2DeltaVsTarget)}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-right bg-risk/5 whitespace-nowrap pr-4 ui-metric">
                                <div className={row.annualDollarLoss > 0 ? 'text-risk' : 'text-accent'}>
                                    {dollarMask(row.annualDollarLoss)}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="px-4 py-3 bg-card border-t border-border flex justify-between items-center ui-caption">
                <div className="flex gap-10">
                    <span className="flex items-center gap-2"><span className="text-accent">●</span> Strategic Alpha</span>
                    <span className="flex items-center gap-2"><span className="text-risk">●</span> Portfolio Erosion</span>
                </div>
                <div>Institutional Benchmark: VTI &middot; Rf: 5.0%</div>
            </div>
        </div>
    );
}
