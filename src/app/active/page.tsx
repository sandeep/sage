import React from 'react';
import { calculateAlphaMetrics, getBookTradeStats, getAlphaNavSeries, AlphaMetrics, BookTradeStats } from '@/lib/logic/alpha/engine/metrics';
import { getShadowVtiSeries } from '@/lib/logic/alpha/engine/shadowPortfolio';
import AlphaNavChart from './AlphaNavChart';
import FloatingTooltip from '../components/FloatingTooltip';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Props {
    searchParams: Promise<{ year?: string }>;
}

export default async function ActiveAlpha({ searchParams }: Props) {
    const { year } = await searchParams;
    
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (year && year !== 'all') {
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
    }

    const metrics = await calculateAlphaMetrics(startDate, endDate);
    const bookStats = await getBookTradeStats(startDate, endDate);
    const alphaNavSeries = await getAlphaNavSeries(startDate, endDate);
    const shadowVtiSeries = await getShadowVtiSeries(startDate, endDate); 

    const shadowMap = new Map(shadowVtiSeries.map(s => [s.date, s.value]));
    const chartData = alphaNavSeries.map(s => ({
        date: s.date,
        alphaNav: s.nav,
        shadowNav: shadowMap.get(s.date) || shadowVtiSeries[0]?.value || 0
    }));

    const years = ['all', '2026', '2025', '2024'];

    return (
        <main className="min-h-screen bg-black text-white font-mono">
            <div className="page-container ui-page-spacing">
                
                <div className="flex justify-between items-end border-b border-zinc-900 pb-8">
                    <div>
                        <h1 className="text-ui-hero">
                            ACTIVE <span className="text-active-accent">PERFORMANCE</span>
                        </h1>
                        <p className="text-ui-label !text-zinc-500 mt-2 uppercase tracking-[0.3em]">Active Performance vs Passive Allocation</p>
                    </div>
                </div>

                <div className="flex bg-zinc-950 border border-zinc-900 p-1 rounded-sm gap-1 w-fit">
                    {years.map(y => (
                        <Link 
                            key={y}
                            href={`/active${y === 'all' ? '' : `?year=${y}`}`}
                            className={`px-6 py-2 text-ui-label font-black uppercase tracking-widest transition-all ${
                                (year === y || (!year && y === 'all')) ? 'bg-active-accent text-white' : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            {y}
                        </Link>
                    ))}
                </div>

                <div className="space-y-12">
                    <section className="space-y-4">
                        <div className="ui-section-header">
                            <h2>Overall Performance</h2>
                            <span>Aggregate Metrics across all Trading Books</span>
                        </div>
                        <MetricParityGrid metrics={metrics} />
                    </section>

                    <section className="space-y-8">
                        <div className="ui-section-header">
                            <h2>Performance By Book</h2>
                            <span>Closed Trade Statistics vs Benchmarks</span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {bookStats.map(stat => (
                                <BookStatCard key={stat.book} stat={stat} />
                            ))}
                        </div>
                    </section>

                    <section>
                        <div className="ui-section-header">
                            <h2>NAV Curve</h2>
                            <span>Actual vs Equivalent VTI</span>
                        </div>
                        <div className="bg-zinc-950/50 border border-zinc-900 p-6 rounded-sm shadow-2xl h-[450px] w-full relative">
                            <AlphaNavChart data={chartData} />
                        </div>
                    </section>
                </div>

                <div className="pt-12 border-t border-zinc-900 flex justify-between items-center text-ui-caption text-zinc-700 uppercase font-black tracking-[0.2em]">
                    <div>Sage Active v2.0</div>
                </div>
            </div>
        </main>
    );
}

const fmtUSD = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtNum = (v: number) => v.toFixed(2);

function MetricParityGrid({ metrics }: { metrics: AlphaMetrics | BookTradeStats }) {
    const isBook = 'book' in metrics;
    const vtiTwr = metrics.vtiTwr ?? 0;
    const alpha = isBook ? (metrics as BookTradeStats).benchmarkAlpha : (metrics as AlphaMetrics).dollarAlpha;
    const pnl = isBook ? (metrics as BookTradeStats).totalNetPnl : (metrics as AlphaMetrics).totalPnl;

    return (
        <div className="space-y-8">
            {/* Top Row: The Bottom Line */}
            <div className="grid grid-cols-2 gap-12 border-b border-zinc-900/50 pb-8">
                <div className="space-y-1">
                    <span className="text-ui-label text-zinc-600 uppercase font-black">Total P&L</span>
                    <div className={`text-ui-data font-black tracking-tighter ${pnl >= 0 ? 'text-active-accent' : 'text-active-risk'}`}>{fmtUSD(pnl)}</div>
                </div>
                <div className="space-y-1">
                    <FloatingTooltip 
                        title="Dollar Alpha" 
                        content={`The dollar amount gained/lost relative to a passive VTI strategy.\n\nBenchmark VTI Return: ${fmtPct(vtiTwr)}`}
                    >
                        <span className="text-ui-label text-zinc-600 uppercase font-black border-b border-zinc-800 border-dashed pb-0.5 cursor-help">Dollar Alpha</span>
                    </FloatingTooltip>
                    <div className={`text-ui-data font-black tracking-tighter ${alpha >= 0 ? 'text-active-accent' : 'text-active-risk'}`}>{fmtUSD(alpha)}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10">
                {/* Headers */}
                <div className="col-span-2 text-[10px] text-zinc-500 uppercase tracking-widest font-black opacity-50 border-b border-zinc-900/50 pb-2">Risk / Reward</div>
                <div className="col-span-2 text-[10px] text-zinc-500 uppercase tracking-widest font-black opacity-50 border-b border-zinc-900/50 pb-2">Execution</div>

                {/* Row 1 */}
                <FloatingTooltip 
                    title="TWR (Time-Weighted)" 
                    content={`The compounded growth rate of $1. Ignores deposit timing.\n\nBenchmark VTI: ${fmtPct(vtiTwr)}\nAlpha: ${fmtPct(metrics.twr - vtiTwr)}`}
                >
                    <MetricTile label="TWR" value={fmtPct(metrics.twr)} color={metrics.twr >= vtiTwr ? 'text-active-accent' : 'text-active-risk'} />
                </FloatingTooltip>

                <FloatingTooltip 
                    title="MWR (IRR)" 
                    content="Your internal rate of return, affected by deposit timing. If MWR < TWR, your entry timing is hurting you."
                >
                    <MetricTile label="MWR (IRR)" value={fmtPct(metrics.mwr)} />
                </FloatingTooltip>

                <MetricTile label="Win Rate" value={fmtPct(metrics.winRate)} />
                <MetricTile label="EV / Trade" value={fmtUSD(metrics.expectedValue)} color="text-zinc-400" />

                {/* Row 2 */}
                <FloatingTooltip 
                    title="Sharpe Ratio" 
                    content="Risk-adjusted return. > 1.0 is good, > 2.0 is institutional. Measures reward per unit of volatility."
                >
                    <MetricTile label="Sharpe" value={fmtNum(metrics.sharpeRatio)} />
                </FloatingTooltip>

                <FloatingTooltip 
                    title="Calmar Ratio" 
                    content="Return vs Max Drawdown. > 0.5 is acceptable, > 1.0 is strong."
                >
                    <MetricTile label="Calmar" value={fmtNum(metrics.calmarRatio)} />
                </FloatingTooltip>

                <MetricTile label="Avg Win" value={fmtUSD(metrics.avgWin)} color="text-active-accent/80" />
                <MetricTile label="Avg Loss" value={fmtUSD(metrics.avgLoss)} color="text-active-risk/80" />
            </div>

            {/* Risk Floor */}
            <div className="pt-6 border-t border-zinc-900/50">
                <div className="grid grid-cols-3 gap-8">
                    <FloatingTooltip title="CVaR 95% (Risk)" content="The average loss expected in the worst 5% of trading days.">
                        <div className="space-y-0.5">
                            <div className="text-[10px] text-zinc-600 font-bold uppercase">CVaR 95%</div>
                            <div className="text-ui-body font-black text-active-risk">{fmtPct(metrics.cvar95)}</div>
                        </div>
                    </FloatingTooltip>
                    <div className="space-y-0.5">
                        <div className="text-[10px] text-zinc-600 font-bold uppercase">Volatility</div>
                        <div className="text-ui-body font-black text-zinc-300">{fmtPct(metrics.volatility)}</div>
                    </div>
                    <div className="space-y-0.5">
                        <div className="text-[10px] text-zinc-600 font-bold uppercase">Max DD</div>
                        <div className="text-ui-body font-black text-active-risk">{fmtPct(metrics.maxDrawdown)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricTile({ label, value, color = 'text-white' }: { label: string, value: string, color?: string }) {
    return (
        <div className="space-y-1.5 group">
            <span className="text-[10px] uppercase text-zinc-600 font-bold tracking-wider group-hover:text-zinc-500 transition-colors block h-4 leading-none">{label}</span>
            <div className={`text-ui-body font-black tracking-tighter ${color}`}>{value}</div>
        </div>
    );
}

function BookStatCard({ stat }: { stat: BookTradeStats }) {
    return (
        <div className="bg-zinc-950/50 border border-zinc-900 rounded-sm shadow-2xl overflow-hidden h-full flex flex-col">
            <div className="bg-zinc-900/50 px-6 py-3 border-b border-zinc-900 flex justify-between items-center shrink-0">
                <span className="text-ui-label font-black uppercase tracking-widest text-active-accent">{stat.book}</span>
                <div className="flex items-center gap-3">
                    {stat.distinctTickerCount > 0 && (
                        <span className="text-ui-caption text-zinc-600 font-black uppercase tracking-widest border-r border-zinc-800 pr-3">
                            {stat.distinctTickerCount} {stat.book === 'Options' ? 'Contracts' : 'Tickers'}
                        </span>
                    )}
                    <span className="text-ui-caption text-zinc-500 font-bold">{stat.totalTrades} Trades</span>
                </div>
            </div>
            
            <div className="p-6 flex-1">
                <MetricParityGrid metrics={stat} />
            </div>
        </div>
    );
}
