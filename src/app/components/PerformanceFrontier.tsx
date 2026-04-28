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
import { usePrivacy } from './PrivacyContext';

interface Props {
    coordinates: {
        vti: Coordinates;
        target: Coordinates;
        actual: Coordinates;
    };
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload;
        const toPct = (v: number) => `${(v * 100).toFixed(1)}%`;
        return (
            <div className="bg-zinc-900 border border-zinc-800 p-4 shadow-2xl font-mono text-[10px] space-y-2">
                <div className="ui-label text-white border-b border-zinc-800 pb-1">{d.label}</div>
                <div className="text-zinc-400">Return (CAGR): <span className="text-white">{toPct(d.return)}</span></div>
                <div className="text-zinc-400">Risk (Volatility): <span className="text-white">{toPct(d.vol)}</span></div>
                <div className="ui-caption mt-2 italic">{d.isCurve ? 'Optimal Simulation' : 'Your Position'}</div>
            </div>
        );
    }
    return null;
};

export default function PerformanceFrontier({ coordinates }: Props) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const { privacy } = usePrivacy();

    const frontierPoints = useMemo(() => {
        const points = [];
        const assets = [
            { r: 0.115, v: 0.17 }, { r: 0.085, v: 0.18 }, { r: 0.130, v: 0.22 },
            { r: 0.050, v: 0.06 }, { r: 0.090, v: 0.20 },
        ];
        for (let i = 0; i < 400; i++) {
            const weights = assets.map(() => Math.random());
            const sum = weights.reduce((a, b) => a + b, 0);
            const normWeights = weights.map(w => w / sum);
            let portRet = 0; let portVol = 0;
            normWeights.forEach((w, idx) => {
                portRet += w * assets[idx].r;
                portVol += w * assets[idx].v;
            });
            const diversificationAlpha = 0.82;
            points.push({ vol: portVol * diversificationAlpha, return: portRet, isCurve: true });
        }
        return points;
    }, []);

    const data = useMemo(() => [
        { ...coordinates.vti, label: privacy ? 'Market' : 'Market (VTI)', fill: '#ffffff', size: 120 },
        { ...coordinates.target, label: privacy ? 'Target' : 'Strategy (Target)', fill: '#6366f1', size: 200 },
        { ...coordinates.actual, label: privacy ? 'Actual' : 'Portfolio (Actual)', fill: '#fb7185', size: 150 },
    ], [coordinates, privacy]);

    const returnDelta = coordinates.target.return - coordinates.actual.return;
    const riskDelta = coordinates.actual.vol - coordinates.target.vol;

    if (!mounted) {
        return <div className="xl:col-span-2 aspect-video min-h-[450px] bg-zinc-900/5 animate-pulse rounded-sm" />;
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-16">
            {/* 1. THE CHART (2/3 Width) */}
            <div className="xl:col-span-2 space-y-10">
                <div className="aspect-video min-h-[450px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 40, right: 40, bottom: 40, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                            <XAxis 
                                type="number" dataKey="vol" name="Risk" unit="%" 
                                domain={[0, 0.25]} stroke="#3f3f46" fontSize={10}
                                tickFormatter={(v) => (v * 100).toFixed(0)}
                                label={{ value: 'ANNUALIZED VOLATILITY (RISK)', position: 'bottom', fill: '#52525b', fontSize: 9, fontWeight: 700 }}
                            />
                            <YAxis 
                                type="number" dataKey="return" name="Return" unit="%" 
                                domain={[0, 0.15]} stroke="#3f3f46" fontSize={10}
                                tickFormatter={(v) => (v * 100).toFixed(0)}
                                label={{ value: 'ANNUALIZED RETURN (REWARD)', angle: -90, position: 'left', fill: '#52525b', fontSize: 9, fontWeight: 700 }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter data={frontierPoints} fill="#10b981" fillOpacity={0.04} shape="circle" isAnimationActive={false} />
                            <Scatter name="Portfolios" data={data} isAnimationActive={false}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={index === 1 ? 4 : 0} stroke={entry.fill} strokeOpacity={0.2} />
                                ))}
                                <LabelList dataKey="label" position="top" fill="#a1a1aa" fontSize={10} offset={12} className="ui-label" />
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                    <div className="absolute top-0 right-0 ui-caption text-emerald-500/40 flex items-center gap-2 pr-4 pt-4">
                        <span className="w-2 h-2 bg-emerald-500/20 rounded-full border border-emerald-500/40" />
                        Theoretical Efficient Frontier
                    </div>
                </div>
            </div>

            {/* 2. THE ANALYTICAL NARRATIVE (1/3 Width) */}
            <div className="space-y-12">
                <div className="space-y-6">
                    <div className="ui-label text-zinc-500 border-b border-zinc-900 pb-4">Forensic Takeaway</div>
                    <div className="space-y-10">
                        <div className="space-y-2">
                            <div className="ui-caption text-rose-500 font-bold uppercase">Alpha Leakage</div>
                            <div className="ui-metric text-rose-400">-{Math.round(returnDelta * 1000) / 10}% <span className="ui-label text-zinc-600 lowercase ml-2 font-normal text-[10px]">Missed Yield</span></div>
                            <p className="ui-value text-zinc-500 leading-relaxed italic">
                                Your portfolio is earning significantly less than its engineered potential. You are sacrificing wealth for no additional stability.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="ui-caption text-zinc-400 font-bold uppercase">Risk Paradox</div>
                            <div className="ui-metric text-zinc-100">{(riskDelta * 100).toFixed(1)}% <span className="ui-label text-zinc-600 lowercase ml-2 font-normal text-[10px]">Risk Offset</span></div>
                            <p className="ui-value text-zinc-500 leading-relaxed italic">
                                The volatility reduction achieved by your drift is mathematically negligible compared to the loss in compounded growth.
                            </p>
                        </div>

                        <div className="bg-emerald-950/5 border border-emerald-900/20 p-6 space-y-3">
                            <div className="ui-caption text-emerald-500 font-black">Strategic Verdict</div>
                            <p className="ui-value text-zinc-300 font-bold leading-relaxed">
                                Following the Strategy (Target) would move your position to the **Absolute Frontier** of the green opportunity set.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
