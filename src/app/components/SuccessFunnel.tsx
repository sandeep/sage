'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';

interface Props {
    initialValue: number;
}

type GoalType = 'PRESERVATION' | 'WITHDRAWAL';
type PortfolioType = 'ACTUAL' | 'TARGET';

export default function SuccessFunnel({ initialValue }: Props) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    const [portfolioType, setPortfolioType] = useState<PortfolioType>('TARGET');
    const [goalType, setGoalType] = useState<GoalType>('PRESERVATION');
    const [withdrawalRate, setWithdrawalRate] = useState(0);

    const runSim = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/performance/montecarlo', {
                method: 'POST',
                body: JSON.stringify({ 
                    portfolioType,
                    withdrawalRate,
                    goal: { type: goalType } 
                })
            });
            setData(await res.json());
        } finally {
            setLoading(false);
        }
    }, [portfolioType, goalType, withdrawalRate]);

    useEffect(() => {
        runSim();
    }, [runSim]);

    const formatCurrency = (val: number) => {
        if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
        if (val >= 1_000) return `$${Math.round(val / 1_000).toLocaleString()}k`;
        return `$${Math.round(val).toLocaleString()}`;
    };

    const chartData = data?.percentiles.p50.map((v: number, i: number) => ({
        year: i,
        p10: data.percentiles.p10[i],
        p50: v,
        p90: data.percentiles.p90[i]
    })) || [];

    return (
        <div className="bg-zinc-950 border border-zinc-900 rounded-sm p-16 space-y-16 shadow-2xl font-mono">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-b border-zinc-900 pb-12">
                <div className="space-y-4">
                    <div className="ui-label">Portfolio Anchor</div>
                    <div className="flex gap-2 bg-zinc-900/50 p-1 rounded-sm border border-zinc-900">
                        {(['TARGET', 'ACTUAL'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setPortfolioType(t)}
                                className={`flex-1 py-2 ui-caption rounded-sm transition-all ${
                                    portfolioType === t ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'
                                }`}
                            >
                                {t === 'TARGET' ? 'Strategy' : 'Current Drift'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="ui-label">Survival Goal</div>
                    <div className="flex gap-2 bg-zinc-900/50 p-1 rounded-sm border border-zinc-900">
                        {(['PRESERVATION', 'WITHDRAWAL'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setGoalType(t)}
                                className={`flex-1 py-2 ui-caption rounded-sm transition-all ${
                                    goalType === t ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'
                                }`}
                            >
                                {t === 'PRESERVATION' ? 'Wealth' : 'Income'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-baseline">
                        <div className="ui-label">Annual Withdrawal</div>
                        <div className="ui-value text-emerald-500 font-black">{withdrawalRate}%</div>
                    </div>
                    <input 
                        type="range" min="0" max="10" step="0.5" 
                        value={withdrawalRate} 
                        onChange={(e) => setWithdrawalRate(parseFloat(e.target.value))}
                        className="w-full h-1 accent-emerald-500 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>

            {loading ? (
                <div className="h-[400px] flex flex-col items-center justify-center space-y-4 bg-zinc-900/5 animate-pulse rounded-sm">
                    <div className="w-12 h-12 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
                    <div className="ui-label opacity-40">Running 5,000 Synthetic Retirements...</div>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-24 items-center">
                    <div className="xl:col-span-2 h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCone" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                                <XAxis dataKey="year" stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis 
                                    stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false}
                                    tickFormatter={(v) => `$${Math.round(v / 1000000)}M`}
                                />
                                <Tooltip 
                                    contentStyle={{ background: '#09090b', border: '1px solid #27272a', fontSize: '10px' }}
                                    itemStyle={{ fontWeight: 'black', textTransform: 'uppercase' }}
                                    formatter={(value) => formatCurrency(value as number)}
                                />
                                <Area type="monotone" dataKey="p90" stroke="#064e3b" fill="transparent" strokeWidth={1} isAnimationActive={false} />
                                <Area type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={3} fill="url(#colorCone)" isAnimationActive={false} />
                                <Area type="monotone" dataKey="p10" stroke="#064e3b" fill="transparent" strokeWidth={1} isAnimationActive={false} />
                                <ReferenceLine y={initialValue} stroke="#fb7185" strokeDasharray="3 3" label={{ value: 'PRESERVATION LINE', position: 'right', fill: '#fb7185', fontSize: 8, fontWeight: 900 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="space-y-12">
                        <div className="text-right border-b border-zinc-900 pb-10">
                            <div className="ui-hero text-emerald-500">
                                {Math.round(data?.successProbability ?? 0)}%
                            </div>
                            <div className="ui-label text-zinc-600 mt-2">Reliability Score</div>
                        </div>

                        <div className="space-y-6">
                            <div className="ui-label border-b border-zinc-900 pb-4 text-zinc-500">Outcome Funnel (30Y)</div>
                            <div className="space-y-8">
                                <div className="flex justify-between items-end border-b border-zinc-900/50 pb-4">
                                    <span className="ui-caption opacity-60">Bull Case (10%)</span>
                                    <span className="ui-metric text-zinc-100 italic">
                                        {formatCurrency(data.percentiles.p90[30])}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end border-b border-zinc-900/50 pb-4">
                                    <span className="ui-caption opacity-60 text-emerald-500">Median Case</span>
                                    <span className="ui-metric text-emerald-500">
                                        {formatCurrency(data.percentiles.p50[30])}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end border-b border-zinc-900/50 pb-4">
                                    <span className="ui-caption opacity-60 text-rose-500">Bear Case (10%)</span>
                                    <span className="ui-metric text-rose-400">
                                        {formatCurrency(data.percentiles.p10[30])}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <p className="ui-caption leading-relaxed italic border-l-2 border-zinc-800 pl-6">
                            * Real-dollar estimates adjusted for historical CPI-U. 
                            Reliability indicates survival probability across 5,000 market regimes.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
