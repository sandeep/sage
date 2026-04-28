'use client';
import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { RegimeEvolution } from '@/lib/types/audit';

interface Props {
    history: RegimeEvolution[];
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload;
        return (
            <div className="bg-zinc-900 border border-zinc-800 p-4 shadow-2xl font-mono text-[10px] space-y-2">
                <div className="font-black text-white uppercase">{d.label}</div>
                <div className="text-zinc-500">{new Date(d.startDate).toLocaleDateString()} — {d.endDate ? new Date(d.endDate).toLocaleDateString() : 'Current'}</div>
                <div className="pt-2 border-t border-zinc-800">
                    <div className="flex justify-between gap-4">
                        <span>Historical Return:</span>
                        <span className="text-white">{(d.nominalReturn * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span>Efficiency (Sharpe):</span>
                        <span className="text-white">{d.sharpeRatio.toFixed(2)}</span>
                    </div>
                </div>
                {d.improvementSharpe !== 0 && (
                    <div className={`pt-1 font-bold ${d.improvementSharpe > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {d.improvementSharpe > 0 ? '↑' : '↓'} {Math.abs(d.improvementSharpe).toFixed(2)} Efficiency Gain
                    </div>
                )}
            </div>
        );
    }
    return null;
};

export default function StrategyEvolutionChart({ history }: Props) {
    if (!history || history.length === 0) return null;

    const data = history.map((v, i) => ({
        ...v,
        index: i + 1,
        shortLabel: `Regime ${i + 1}`,
        color: i === history.length - 1 ? '#10b981' : '#27272a'
    }));

    return (
        <div className="bg-zinc-950 border border-zinc-900 rounded-sm p-10 space-y-10 shadow-2xl">
            <div className="flex justify-between items-baseline border-b border-zinc-900 pb-8">
                <div className="text-base font-black uppercase tracking-widest text-zinc-100">
                    Strategy Evolution Ledger
                </div>
                <div className="text-xs text-zinc-500 uppercase font-bold tracking-tighter">
                    Tracking Strategic Improvement Over Time
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                            <XAxis 
                                dataKey="shortLabel" 
                                stroke="#3f3f46" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false}
                            />
                            <YAxis 
                                stroke="#3f3f46" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false}
                                label={{ value: 'EFFICIENCY (SHARPE)', angle: -90, position: 'insideLeft', fill: '#52525b', fontSize: 9, fontWeight: 900 }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#18181b', opacity: 0.4 }} />
                            <Bar dataKey="sharpeRatio" radius={[2, 2, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="space-y-8">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Regime Verdict</div>
                    {data.length > 1 ? (
                        <div className="space-y-6">
                            <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-sm">
                                <div className="text-2xl font-black text-emerald-400 mb-1">
                                    +{(data[data.length-1].improvementSharpe).toFixed(2)}
                                </div>
                                <div className="text-xs text-zinc-400 uppercase font-bold tracking-tighter">Efficiency Gain in latest update</div>
                            </div>
                            <p className="text-sm text-zinc-500 leading-relaxed italic">
                                Your strategy has evolved through <span className="text-zinc-200 font-bold">{data.length} distinct regimes</span>. 
                                The latest iteration improved the 50-year risk-adjusted efficiency by 
                                <span className="text-emerald-400 font-bold mx-1">{(data[data.length-1].improvementSharpe * 100).toFixed(0)}%</span>.
                            </p>
                        </div>
                    ) : (
                        <div className="text-sm text-zinc-600 italic leading-relaxed">
                            Baseline strategy established. Future updates will be tracked here to measure your &ldquo;Strategic Alpha&rdquo; growth.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
