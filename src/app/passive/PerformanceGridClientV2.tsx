'use client';
import React, { useState, useEffect } from 'react';
import FloatingTooltip from '../components/FloatingTooltip';

interface HorizonResult {
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
    totalValue: number;
}

const fmtPct = (v: number | null) => v !== null ? `${(v * 100).toFixed(1)}%` : '—';
const fmtNum = (v: number | null) => v !== null ? v.toFixed(2) : '—';
const fmtUSD = (val: number | null) => {
    if (val === null) return '—';
    const absVal = Math.abs(val);
    if (absVal >= 1_000_000) return '$' + (absVal / 1_000_000).toFixed(2) + 'M';
    if (absVal >= 1_000) return '$' + (absVal / 1_000).toFixed(1) + 'k';
    return '$' + Math.round(absVal);
};

export default function PerformanceGridClientV2({ data, totalValue }: Props) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <section className="space-y-32">
                <div className="h-[400px] bg-zinc-900/5 animate-pulse rounded-sm border border-zinc-900" />
            </section>
        );
    }

    return (
        <div className="space-y-32">
            {/* 1. NOMINAL PERFORMANCE */}
            <section className="space-y-12">
                <div className="ui-section-header">
                    <h2>Nominal Performance</h2>
                    <span>Annualized TWR Basis</span>
                </div>
                
                <div className="w-full bg-black border border-zinc-900/50 rounded-sm shadow-2xl overflow-hidden font-mono">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left min-w-[1000px] table-fixed">
                            <thead>
                                <tr className="ui-label border-b border-zinc-900 bg-zinc-900/30">
                                    <th className="px-6 py-5 border-r border-zinc-800 w-[12%] italic text-zinc-500">Horizon</th>
                                    <th className="px-6 py-5 text-right border-r border-zinc-800 text-zinc-400 w-[18%]">1. Market Standard (VTI)</th>
                                    <th className="px-6 py-5 text-right border-r border-zinc-800 text-emerald-500 bg-emerald-500/5 w-[25%]">2. Strategy Potential</th>
                                    <th className="px-6 py-5 text-right border-r border-zinc-800 text-white bg-white/5 w-[25%]">3. Portfolio Realization</th>
                                    <th className="px-6 py-5 text-right text-rose-500 bg-rose-500/5 w-[20%]">4. Execution Gap</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900/50">
                                {data.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-zinc-900/40 transition-colors group">
                                        <td className="px-6 py-6 border-r border-zinc-800">
                                            <div className="ui-label text-zinc-100 font-black tracking-tighter">{row.horizon}</div>
                                            {row.isProxy && <div className="ui-caption text-zinc-600 mt-1 uppercase tracking-widest">Proxy</div>}
                                        </td>
                                        <td className="px-6 py-6 text-right border-r border-zinc-800 ui-value text-zinc-400 font-bold tabular-nums">
                                            {fmtPct(row.marketReturn)}
                                        </td>
                                        <td className="px-6 py-6 text-right border-r border-zinc-800 bg-emerald-500/[0.02] ui-value text-emerald-500/80 font-black tabular-nums">
                                            <div>{fmtPct(row.targetReturn)}</div>
                                            <div className="ui-caption text-emerald-900 font-bold mt-1 uppercase whitespace-nowrap">{fmtUSD(row.targetReturn * totalValue)}</div>
                                        </td>
                                        <td className="px-6 py-6 text-right border-r border-zinc-800 bg-white/[0.02] ui-value text-white font-black tabular-nums">
                                            <div>{fmtPct(row.portfolioReturn)}</div>
                                            <div className="ui-caption text-zinc-600 font-bold mt-1 uppercase whitespace-nowrap">{fmtUSD(row.portfolioReturn * totalValue)}</div>
                                        </td>
                                        <td className="px-6 py-6 text-right bg-rose-500/[0.02] ui-value font-black tabular-nums text-rose-500">
                                            <div>{(row.portfolioReturn - row.targetReturn) > 0 ? '+' : ''}{fmtPct(row.portfolioReturn - row.targetReturn)}</div>
                                            <div className="ui-caption text-rose-900 font-bold mt-1 uppercase whitespace-nowrap">-{fmtUSD(row.annualDollarLoss)}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* 2. RISK ADJUSTED PERFORMANCE */}
            <section className="space-y-12">
                <div className="ui-section-header">
                    <h2>Risk Adjusted Performance</h2>
                    <span>Sharpe & Capture Analysis</span>
                </div>
                
                <div className="w-full bg-black border border-zinc-900/50 rounded-sm shadow-2xl overflow-hidden font-mono">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left min-w-[1000px] table-fixed">
                            <thead>
                                <tr className="ui-label border-b border-zinc-900 bg-zinc-900/30">
                                    <th className="px-6 py-5 border-r border-zinc-800 w-[12%] italic text-zinc-500">Horizon</th>
                                    <th className="px-6 py-5 text-right border-r border-zinc-800 text-zinc-400 w-[20%]">
                                        <FloatingTooltip title="Sharpe Ratio" content="Physical measure of return per unit of risk. Higher is better. Focuses on the efficiency of your volatility.">
                                            Standard Sharpe
                                        </FloatingTooltip>
                                    </th>
                                    <th className="px-6 py-5 text-right border-r border-zinc-800 text-emerald-500 bg-emerald-500/5 w-[22%]">
                                        <FloatingTooltip title="Modigliani-Modigliani (M2)" content="The return your strategy would have achieved if it had the same risk level as the market. Allows direct comparison between portfolios with different volatility.">
                                            Strategy M2 Return
                                        </FloatingTooltip>
                                    </th>
                                    <th className="px-6 py-5 text-right border-r border-zinc-800 text-white bg-white/5 w-[22%]">
                                        <FloatingTooltip title="Portfolio M2" content="The risk-adjusted reality of your actual holdings. Physically shows your real performance when normalized for risk exposure.">
                                            Portfolio M2 Return
                                        </FloatingTooltip>
                                    </th>
                                    <th className="px-6 py-5 text-right text-rose-500 bg-rose-500/5 w-[24%]">
                                        <FloatingTooltip title="Information Ratio (Execution Alpha)" content="The consistency and efficiency of your outperformance. A negative value represents 'Alpha Leakage' caused by unintentional drift.">
                                            Execution Alpha (M2 Δ)
                                        </FloatingTooltip>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900/50">
                                {data.map((row, idx) => {
                                    const strategyM2 = row.targetM2VsVti + row.marketReturn;
                                    const portfolioM2 = row.portfolioM2VsVti + row.marketReturn;
                                    const executionAlpha = portfolioM2 - strategyM2;

                                    return (
                                        <tr key={idx} className="hover:bg-zinc-900/40 transition-colors group">
                                            <td className="px-6 py-6 border-r border-zinc-800">
                                                <div className="ui-label text-zinc-100 font-black tracking-tighter">{row.horizon}</div>
                                            </td>
                                            <td className="px-6 py-6 text-right border-r border-zinc-800 ui-value text-zinc-500 font-bold tabular-nums">
                                                {fmtNum(row.portfolioSharpe)} <span className="ui-caption opacity-30 mx-1">vs</span> {fmtNum(row.targetSharpe)}
                                            </td>
                                            <td className="px-6 py-6 text-right border-r border-zinc-800 bg-emerald-500/[0.02] ui-value text-emerald-700 font-black tabular-nums">
                                                {fmtPct(strategyM2)}
                                            </td>
                                            <td className="px-6 py-6 text-right border-r border-zinc-800 bg-white/[0.02] ui-value text-white font-black tabular-nums">
                                                {fmtPct(portfolioM2)}
                                            </td>
                                            <td className="px-6 py-6 text-right border-r border-zinc-800 bg-rose-500/[0.02] ui-value font-black tabular-nums text-rose-500">
                                                {executionAlpha > 0 ? '+' : ''}{fmtPct(executionAlpha)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}
