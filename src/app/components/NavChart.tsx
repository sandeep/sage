'use client';
import React from 'react';
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

export interface NavPoint {
    t: string;
    vti: number;
    target: number | null;
    actual: number | null;
    proposed?: number | null;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
        const toPct = (v: number) => `${(v).toFixed(1)}%`;
        return (
            <div className="bg-card border border-zinc-faint p-4 shadow-2xl font-mono text-[10px] space-y-2">
                <div className="font-black text-white uppercase border-b border-zinc-faint pb-1">{payload[0].payload.t}</div>
                <div className="text-meta text-[9px] uppercase font-black tracking-widest">Portfolio Drawdown · Peak-to-Trough</div>
                <div className="space-y-1 pt-1">
                    <div className="flex justify-between gap-8">
                        <span className="text-truth">Market (VTI):</span>
                        <span className="text-foreground font-bold">{toPct(payload[0].payload.vti)}</span>
                    </div>
                    {payload[0].payload.actual != null && (
                        <div className="flex justify-between gap-8">
                            <span className="text-risk font-bold">Actual:</span>
                            <span className="text-risk font-black">{toPct(payload[0].payload.actual)}</span>
                        </div>
                    )}
                    {payload[0].payload.target != null && (
                        <div className="flex justify-between gap-8">
                            <span className="text-accent font-bold">Strategy:</span>
                            <span className="text-accent font-black">{toPct(payload[0].payload.target)}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

export default function NavChart({ navSeries, showActual }: {
    navSeries: NavPoint[];
    showActual: boolean;
    showProposed: boolean;
}) {
    // ── DRAWDOWN MATH ────────────────────────────────────────────────────────
    // We convert the NAV (Base 100) into "Underwater" percentages
    const calculateDrawdowns = (data: NavPoint[]) => {
        let peakVti = 0;
        let peakTarget = 0;
        let peakActual = 0;

        return data.map(p => {
            peakVti = Math.max(peakVti, p.vti);
            const ddVti = ((p.vti / peakVti) - 1) * 100;

            let ddTarget = null;
            if (p.target != null) {
                peakTarget = Math.max(peakTarget, p.target);
                ddTarget = ((p.target / peakTarget) - 1) * 100;
            }

            let ddActual = null;
            if (p.actual != null) {
                peakActual = Math.max(peakActual, p.actual);
                ddActual = ((p.actual / peakActual) - 1) * 100;
            }

            return { t: p.t, vti: ddVti, target: ddTarget, actual: ddActual };
        });
    };

    const drawdownData = calculateDrawdowns(navSeries);

    return (
        <div className="w-full h-[400px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={drawdownData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--risk)" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="var(--risk)" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis 
                        dataKey="t" 
                        stroke="var(--zinc-dim)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        interval={Math.floor(drawdownData.length / 8)}
                    />
                    <YAxis 
                        stroke="var(--zinc-dim)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(v) => `${v}%`}
                        domain={[-60, 0]}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--zinc-faint)' }} />
                    <ReferenceLine y={0} stroke="var(--zinc-faint)" strokeWidth={2} />
                    
                    <Area 
                        type="monotone" 
                        dataKey="vti" 
                        stroke="var(--zinc-meta)" 
                        strokeWidth={1}
                        fill="transparent"
                        isAnimationActive={false} 
                    />
                    {showActual && (
                        <Area 
                            type="monotone" 
                            dataKey="actual" 
                            stroke="var(--risk)" 
                            strokeWidth={3}
                            fill="url(#colorActual)"
                            isAnimationActive={false} 
                        />
                    )}
                    <Area 
                        type="monotone" 
                        dataKey="target" 
                        stroke="var(--accent)" 
                        strokeWidth={3}
                        fill="url(#colorTarget)"
                        isAnimationActive={false} 
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
