import React from 'react';
import { calculateAlphaMetrics, getBookTradeStats, getAlphaNavSeries } from '@/lib/logic/alpha/engine/metrics';
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

    const metrics = await calculateAlphaMetrics();
    const bookStats = await getBookTradeStats();
    const alphaNavSeries = await getAlphaNavSeries();
    const shadowVtiSeries = await getShadowVtiSeries(); 

    // Align series for the chart
    const shadowMap = new Map(shadowVtiSeries.map(s => [s.date, s.value]));

    const chartData = alphaNavSeries.map(s => ({
        date: s.date,
        alphaNav: s.nav,
        shadowNav: shadowMap.get(s.date) || shadowVtiSeries[0]?.value || 0
    }));

    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
    const fmtNum = (v: number) => v.toFixed(2);
    const fmtUSD = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    const years = ['all', '2024', '2025', '2026'];

    return (
        <main className="min-h-screen bg-black text-white font-mono">
            <div className="page-container ui-page-spacing">
                
                <div className="flex justify-between items-end border-b border-zinc-900 pb-8">
                    <div>
                        <h1 className="text-ui-hero">
                            ACTIVE PERFORMANCE
                        </h1>
                        <p className="text-ui-label !text-zinc-500 mt-2 uppercase tracking-[0.3em]">Active Performance vs Passive Allocation</p>
                    </div>
                </div>

                {/* Year Selector - Isolated Row */}
                <div className="flex bg-zinc-950 border border-zinc-900 p-1 rounded-sm gap-1 w-fit">
                    {years.map(y => (
                        <Link 
                            key={y}
                            href={`/active${y === 'all' ? '' : `?year=${y}`}`}
                            className={`px-6 py-2 text-ui-label font-black uppercase tracking-widest transition-all ${
                                (year === y || (!year && y === 'all')) ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            {y}
                        </Link>
                    ))}
                </div>

                {/* UNIFIED PERFORMANCE COMMAND CENTER */}
                <section className="space-y-4">
                    {/* Primary Performance Row */}
                    <div className="ui-metric-grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                        <MetricTile 
                            label="Total P&L" 
                            value={fmtUSD(metrics.totalPnl)} 
                            color={metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-500'} 
                        />

                        <FloatingTooltip 
                            title="Dollar Alpha" 
                            content="The exact dollar amount you have gained or lost relative to a passive VTI strategy. Calculated by comparing your actual NAV to an equivalent portfolio that bought VTI on every deposit date."
                        >
                            <MetricTile 
                                label="Dollar Alpha" 
                                value={fmtUSD(metrics.dollarAlpha)} 
                                color={metrics.dollarAlpha >= 0 ? 'text-emerald-400' : 'text-rose-500'}
                            />
                        </FloatingTooltip>
                        
                        <FloatingTooltip title="TWR" content="Geometric mean of periodic returns.">
                            <MetricTile label="TWR" value={fmtPct(metrics.twr)} />
                        </FloatingTooltip>

                        <FloatingTooltip title="MWR" content="Internal Rate of Return (IRR).">
                            <MetricTile label="MWR / IRR" value={fmtPct(metrics.mwr)} />
                        </FloatingTooltip>

                        <FloatingTooltip title="Sharpe" content="Reward per unit of risk.">
                            <MetricTile label="Sharpe" value={fmtNum(metrics.sharpeRatio)} />
                        </FloatingTooltip>

                        <FloatingTooltip title="Calmar" content="Return vs Max Drawdown.">
                            <MetricTile label="Calmar" value={fmtNum(metrics.calmarRatio)} />
                        </FloatingTooltip>
                    </div>

                    {/* Risk & Equivalent Portfolio Row */}
                    <div className="ui-metric-grid grid-cols-1 md:grid-cols-4">
                        <FloatingTooltip title="Equivalent VTI Value" content="Estimated current value if 100% of Active deposits were put into VTI instead.">
                            <MetricTile label="Equivalent VTI" value={fmtUSD(metrics.shadowNav)} color="text-zinc-100" />
                        </FloatingTooltip>
                        
                        <FloatingTooltip title="Conditional Value at Risk (CVaR)" content="The average loss in the worst 5% of trading days.">
                            <MetricTile label="CVaR 95%" value={fmtPct(metrics.cvar95)} color="text-rose-400" />
                        </FloatingTooltip>

                        <FloatingTooltip title="Volatility" content="Annualized standard deviation of daily returns.">
                            <MetricTile label="Volatility" value={fmtPct(metrics.volatility)} color="text-zinc-300" />
                        </FloatingTooltip>

                        <FloatingTooltip title="Max Drawdown" content="Largest peak-to-trough decline observed.">
                            <MetricTile label="Max Drawdown" value={fmtPct(metrics.maxDrawdown)} color="text-rose-500" />
                        </FloatingTooltip>
                    </div>
                </section>

                {/* Performance By Book */}
                <section>
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

                {/* NAV Curve Section */}
                <section>
                    <div className="ui-section-header">
                        <h2>NAV Curve</h2>
                        <span>Actual vs Equivalent VTI</span>
                    </div>
                    <div className="bg-zinc-950/50 border border-zinc-900 p-6 rounded-sm shadow-2xl h-[450px] w-full relative">
                        <AlphaNavChart data={chartData} />
                    </div>
                </section>

                {/* Footer Meta */}
                <div className="pt-12 border-t border-zinc-900 flex justify-between items-center text-ui-caption text-zinc-700 uppercase font-black tracking-[0.2em]">
                    <div>Sage Active v2.0</div>
                </div>
            </div>
        </main>
    );
}

function MetricTile({ label, value, color = 'text-white' }: { label: string, value: string, color?: string }) {
    return (
        <div className="bg-zinc-950/50 border border-zinc-900 p-6 rounded-sm shadow-xl space-y-2 w-full h-full hover:bg-zinc-900/50 transition-colors group">
            <span className="text-ui-label uppercase text-zinc-600 font-black tracking-widest group-hover:text-zinc-500">{label}</span>
            <div className={`text-ui-data font-black tracking-tighter ${color}`}>{value}</div>
        </div>
    );
}

function BookStatCard({ stat }: { stat: any }) {
    const fmtUSD = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
    const fmtNum = (v: number) => v.toFixed(2);

    return (
        <div className="bg-zinc-950/50 border border-zinc-900 rounded-sm shadow-2xl overflow-hidden h-full">
            <div className="bg-zinc-900/50 px-6 py-3 border-b border-zinc-900 flex justify-between items-center">
                <span className="text-ui-label font-black uppercase tracking-widest text-emerald-400">{stat.book}</span>
                <div className="flex items-center gap-3">
                    {stat.distinctTickerCount > 0 && (
                        <span className="text-ui-caption text-zinc-600 font-black uppercase tracking-widest border-r border-zinc-800 pr-3">
                            {stat.distinctTickerCount} {stat.book === 'Options' ? 'Contracts' : 'Tickers'}
                        </span>
                    )}
                    <span className="text-ui-caption text-zinc-500 font-bold">{stat.totalTrades} Trades</span>
                </div>
            </div>
            <div className="p-6 space-y-4">
                <div className="flex justify-between items-end border-b border-zinc-900/50 pb-2">
                    <span className="text-ui-label text-zinc-500 uppercase">Net Profit</span>
                    <span className={`text-ui-data font-black ${stat.totalNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                        {fmtUSD(stat.totalNetPnl)}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <FloatingTooltip title="Win Rate" content="Percentage of trades that resulted in a positive P&L.">
                            <span className="text-ui-label text-zinc-600 uppercase font-black">Win Rate</span>
                        </FloatingTooltip>
                        <div className="text-ui-body font-black text-zinc-300">{fmtPct(stat.winRate)}</div>
                    </div>
                    <div className="space-y-1">
                        <FloatingTooltip title="MWR" content="Actual return on capital deployed. Reflects the annualized IRR of the specific trades in this book.">
                            <span className="text-ui-label text-zinc-600 uppercase font-black">MWR</span>
                        </FloatingTooltip>
                        <div className="text-ui-body font-black text-zinc-300">{stat.mwr !== 0 ? fmtPct(stat.mwr) : '—'}</div>
                    </div>
                    <div className="space-y-1 border-t border-zinc-900/50 pt-3">
                        <span className="text-ui-label text-zinc-600 uppercase font-black">Sharpe</span>
                        <div className="text-ui-body font-black text-zinc-300">{fmtNum(stat.sharpeRatio)}</div>
                    </div>
                    <div className="space-y-1 border-t border-zinc-900/50 pt-3">
                        <span className="text-ui-label text-zinc-600 uppercase font-black">Calmar</span>
                        <div className="text-ui-body font-black text-zinc-300">{fmtNum(stat.calmarRatio)}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-ui-label text-zinc-600 uppercase font-black">Avg Win</span>
                        <div className="text-ui-body font-black text-emerald-500/80">{fmtUSD(stat.avgWin)}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-ui-label text-zinc-600 uppercase font-black">Avg Loss</span>
                        <div className="text-ui-body font-black text-rose-500/80">{fmtUSD(stat.avgLoss)}</div>
                    </div>
                </div>
                <div className="pt-2 border-t border-zinc-900/50">
                    <div className="flex justify-between items-center">
                        <span className="text-ui-label text-zinc-500 uppercase font-black">Benchmark Alpha</span>
                        <span className={`text-ui-body font-black ${stat.benchmarkAlpha >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {fmtUSD(stat.benchmarkAlpha)}
                        </span>
                    </div>
                </div>
                <div className="pt-2">
                    <div className="flex justify-between items-center">
                        <span className="text-ui-label text-zinc-500 uppercase font-black text-ui-caption">Expected Value</span>
                        <span className="text-ui-body font-black text-zinc-400">{fmtUSD(stat.expectedValue)} / trade</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
