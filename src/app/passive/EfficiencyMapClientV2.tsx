'use client';
import React, { useMemo } from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LabelList,
} from 'recharts';
import { Coordinates } from '@/lib/types/audit';

interface Props {
    coordinates: {
        vti: Coordinates;
        target: Coordinates;
        actual: Coordinates;
    };
    snapshotTrail: { date: string; label: string | null; return: number; vol: number }[];
    frontierPoints: {
        points: { vol: number; return: number; isCurve: boolean }[];
        cloud: { vol: number; return: number; isCurve: boolean }[];
    };
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload;
        const toPct = (v: number) => `${(v * 100).toFixed(1)}%`;
        const labelStr = d.label || (d.isCurve ? 'Absolute Frontier' : (d.isTrail ? 'Historical Snapshot' : 'Optimal Permutation'));
        
        return (
            <div className="bg-card border border-zinc-900/50 p-4 shadow-2xl font-mono text-[10px] space-y-2">
                <div className="ui-label text-white border-b border-zinc-900/50 pb-1">{labelStr}</div>
                <div className="text-truth">Return (CAGR): <span className="text-white">{toPct(d.return)}</span></div>
                <div className="text-truth">Risk (Volatility): <span className="text-white">{toPct(d.vol)}</span></div>
                <div className="ui-caption mt-2 italic text-meta">
                    {d.isCurve ? 'Theoretical Limit' : d.isTrail ? 'Historical State' : 'Asset Mix Variation'}
                </div>
            </div>
        );
    }
    return null;
};

export default function EfficiencyMapClientV2({ coordinates, snapshotTrail, frontierPoints }: Props) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const data = useMemo(() => [
        { ...coordinates.vti, label: 'Market (VTI)', fill: '#ffffff', size: 120 },
        { ...coordinates.target, label: 'Strategy (Target)', fill: '#6366f1', size: 200 },
        { ...coordinates.actual, label: 'Portfolio (Actual)', fill: '#fb7185', size: 150 },
    ], [coordinates]);

    const trailData = useMemo(() =>
        snapshotTrail.map((p, i) => ({
            vol: p.vol,
            return: p.return,
            label: p.label ?? p.date.slice(0, 7),
            fill: '#f59e0b',
            size: 80,
            isTrail: true,
            index: i,
        })),
    [snapshotTrail]);

    const returnDelta = coordinates.target.return - coordinates.actual.return;
    const riskDelta = coordinates.actual.vol - coordinates.target.vol;

    if (!mounted) {
        return (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-16">
                <div className="xl:col-span-2 aspect-video min-h-[450px] bg-zinc-900/5 animate-pulse rounded-sm" />
                <div className="space-y-12 animate-pulse">
                    <div className="h-8 bg-zinc-900/10 rounded w-1/2" />
                    <div className="space-y-4">
                        <div className="h-20 bg-zinc-900/10 rounded" />
                        <div className="h-20 bg-zinc-900/10 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-16">
            <div className="xl:col-span-2 aspect-video min-h-[450px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 40, right: 40, bottom: 40, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                        <XAxis type="number" dataKey="vol" name="Risk" unit="%" domain={[0, 0.25]} stroke="#3f3f46" fontSize={10} tickFormatter={(v) => (v * 100).toFixed(0)} label={{ value: 'ANNUALIZED VOLATILITY (RISK)', position: 'bottom', fill: '#52525b', fontSize: 9, fontWeight: 700 }} />
                        <YAxis type="number" dataKey="return" name="Return" unit="%" domain={[0, 0.15]} stroke="#3f3f46" fontSize={10} tickFormatter={(v) => (v * 100).toFixed(0)} label={{ value: 'ANNUALIZED RETURN (REWARD)', angle: -90, position: 'left', fill: '#52525b', fontSize: 9, fontWeight: 700 }} />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        
                        {/* Opportunity Cloud */}
                        <Scatter 
                            name="Opportunity Cloud" 
                            data={frontierPoints.cloud} 
                            fill="#10b981" 
                            fillOpacity={0.04} 
                            shape="circle" 
                            isAnimationActive={false} 
                        />
                        
                        {/* Efficient Frontier Curve */}
                        <Scatter 
                            name="Efficient Frontier" 
                            data={frontierPoints.points} 
                            fill="#10b981" 
                            line={{ stroke: '#10b981', strokeWidth: 2 }} 
                            shape={() => null} // Don't render individual points for the curve
                            isAnimationActive={false} 
                        />

                        <Scatter name="Portfolios" data={data} isAnimationActive={false}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={index === 1 ? 4 : 0} stroke={entry.fill} strokeOpacity={0.2} />
                            ))}
                            <LabelList dataKey="label" position="top" fill="#a1a1aa" fontSize={10} offset={12} className="ui-label" />
                        </Scatter>
                        {trailData.length > 0 && (
                            <Scatter
                                name="Snapshots"
                                data={trailData}
                                isAnimationActive={false}
                            >
                                {trailData.map((_, index) => (
                                    <Cell key={`trail-${index}`} fill="#f59e0b" fillOpacity={0.7} />
                                ))}
                                <LabelList dataKey="label" position="top" fill="#f59e0b" fontSize={9} offset={10} />
                            </Scatter>
                        )}
                    </ScatterChart>
                </ResponsiveContainer>
                <div className="absolute top-0 right-0 ui-caption text-emerald-500/40 flex items-center gap-2 pr-4 pt-4">
                    <span className="w-2 h-2 bg-emerald-500/20 rounded-full border border-emerald-500/40" />
                    Theoretical Efficient Frontier
                </div>
            </div>

            <div className="space-y-12">
                <div className="space-y-6">
                    <div className="text-ui-header text-truth border-b border-zinc-900/50 pb-4">Forensic Takeaway</div>
                    <div className="space-y-10">
                        <div className="space-y-2">
                            <div className="ui-caption text-risk font-bold uppercase">Alpha Leakage</div>
                            <div className="ui-metric text-risk">-{Math.round(returnDelta * 1000) / 10}% <span className="ui-label text-meta lowercase ml-2 font-normal text-[10px]">Missed Yield</span></div>
                            <p className="ui-value text-meta leading-relaxed italic">
                                Your portfolio is earning significantly less than its engineered potential. You are sacrificing wealth for no additional stability.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="ui-caption text-truth font-bold uppercase">Risk Paradox</div>
                            <div className="ui-metric text-white">{(riskDelta * 100).toFixed(1)}% <span className="ui-label text-meta lowercase ml-2 font-normal text-[10px]">Risk Offset</span></div>
                            <p className="ui-value text-meta leading-relaxed italic">
                                The volatility reduction achieved by your drift is mathematically negligible compared to the loss in compounded growth.
                            </p>
                        </div>

                        <div className="bg-accent/5 border border-accent/20 p-6 space-y-3">
                            <div className="ui-caption text-accent font-black">Strategic Verdict</div>
                            <p className="ui-value text-truth font-bold leading-relaxed">
                                Following the Strategy (Target) would move your position to the **Absolute Frontier** of the green opportunity set.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
