'use client';
import React, { useMemo, useState } from 'react';
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
    ReferenceLine
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
    globalFrontierPoints: {
        points: { vol: number; return: number; isCurve: boolean }[];
    };
}

const findOptimalReturnAtRisk = (points: { vol: number, return: number }[], targetVol: number) => {
    if (!points || points.length === 0) return 0;
    let best = points[0];
    let minDist = Math.abs(best.vol - targetVol);
    points.forEach(p => {
        const dist = Math.abs(p.vol - targetVol);
        if (dist < minDist) {
            minDist = dist;
            best = p;
        }
    });
    return best.return;
};

const CustomTooltip = ({ active, payload, localPoints, targetVol }: { active?: boolean; payload?: any[]; localPoints: any[]; targetVol: number }) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload;
        const toPct = (v: number) => `${(v * 100).toFixed(1)}%`;
        const labelStr = d.label || (d.isGlobal ? 'Strategic Global Frontier' : (d.isCurve ? 'Local Portfolio Frontier' : (d.isTrail ? 'Historical Snapshot' : 'Simulated Portfolio')));
        
        let dragSection = null;
        if (!d.isCurve && !d.isGlobal) {
            const optimalReturn = findOptimalReturnAtRisk(localPoints, d.vol);
            const returnDrag = d.return - optimalReturn; // Delta Y
            
            const riskDrag = d.vol - targetVol; // Delta X
            
            // Only show if drag is meaningful
            if (Math.abs(returnDrag) > 0.001 || Math.abs(riskDrag) > 0.001) {
                dragSection = (
                    <div className="pt-2 mt-2 border-t border-zinc-800 space-y-2">
                        <div>
                            <div className="text-zinc-500 text-[9px] uppercase tracking-wider flex items-center gap-1">
                                <span className="w-2 h-[2px] bg-amber-500 inline-block" /> Return Drag (ΔY)
                            </div>
                            <div className="text-amber-500 font-bold">{toPct(returnDrag)} <span className="text-zinc-600 font-normal ml-1">vs {toPct(optimalReturn)} ceiling</span></div>
                        </div>
                        <div>
                            <div className="text-zinc-500 text-[9px] uppercase tracking-wider flex items-center gap-1">
                                <span className="w-2 h-[2px] bg-rose-500 inline-block" /> Risk Excess (ΔX)
                            </div>
                            <div className="text-rose-500 font-bold">{(riskDrag > 0 ? '+' : '')}{toPct(riskDrag)} <span className="text-zinc-600 font-normal ml-1">vs {toPct(targetVol)} target</span></div>
                        </div>
                    </div>
                );
            }
        }

        return (
            <div className="bg-card border border-zinc-900/50 p-4 shadow-2xl font-mono text-[10px] space-y-2 relative z-50">
                <div className="ui-label text-white border-b border-zinc-900/50 pb-1">{labelStr}</div>
                <div className="text-truth">Return (CAGR): <span className="text-white">{toPct(d.return)}</span></div>
                <div className="text-truth">Risk (Volatility): <span className="text-white">{toPct(d.vol)}</span></div>
                {dragSection}
                <div className="ui-caption mt-2 italic text-meta">
                    {d.isGlobal ? 'Market Ceiling' : d.isCurve ? 'Current Asset Ceiling' : d.isTrail ? 'Historical State' : 'Asset Mix Variation'}
                </div>
            </div>
        );
    }
    return null;
};

export default function EfficiencyMapClientV2({ coordinates, snapshotTrail, frontierPoints, globalFrontierPoints }: Props) {
    const [mounted, setMounted] = useState(false);
    const [hoveredDot, setHoveredDot] = useState<any>(null);
    React.useEffect(() => setMounted(true), []);

    const data = useMemo(() => [
        { ...coordinates.vti, label: 'Market (VTI)', fill: '#ffffff', size: 120, pos: 'right', off: 10 },
        { ...coordinates.target, label: 'Strategy (Target)', fill: '#6366f1', size: 200, pos: 'top', off: 15 },
        { ...coordinates.actual, label: 'Portfolio (Actual)', fill: '#fb7185', size: 150, pos: 'bottom', off: 15 },
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
            pos: 'top',
            off: 8
        })),
    [snapshotTrail]);

    // Error Decomposition Math
    const actualVol = coordinates.actual.vol;
    const localCeiling = findOptimalReturnAtRisk(frontierPoints.points, actualVol);
    const globalCeiling = findOptimalReturnAtRisk(globalFrontierPoints.points, actualVol);

    const executionError = localCeiling - coordinates.actual.return;
    const selectionError = globalCeiling - localCeiling;
    const totalEfficiencyGap = globalCeiling - coordinates.actual.return;

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
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-24">
            <div className="xl:col-span-2 aspect-video min-h-[500px] relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart 
                        margin={{ top: 60, right: 60, bottom: 40, left: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                        <XAxis type="number" dataKey="vol" name="Risk" unit="%" domain={[0, 0.25]} stroke="#3f3f46" fontSize={10} tickFormatter={(v) => (v * 100).toFixed(0)} label={{ value: 'ANNUALIZED VOLATILITY (RISK)', position: 'bottom', fill: '#52525b', fontSize: 9, fontWeight: 700 }} />
                        <YAxis type="number" dataKey="return" name="Return" unit="%" domain={[0, 0.15]} stroke="#3f3f46" fontSize={10} tickFormatter={(v) => (v * 100).toFixed(0)} label={{ value: 'ANNUALIZED RETURN (REWARD)', angle: -90, position: 'left', fill: '#52525b', fontSize: 9, fontWeight: 700 }} />
                        <Tooltip cursor={false} content={<CustomTooltip localPoints={frontierPoints.points} targetVol={coordinates.target.vol} />} />
                        
                        <Scatter 
                            name="Local Opportunity Set" 
                            data={frontierPoints.cloud} 
                            fill="#10b981" 
                            fillOpacity={0.02} 
                            shape="circle" 
                            isAnimationActive={false} 
                        />
                        
                        {/* Global Strategic Frontier */}
                        <Scatter 
                            name="Global Strategic Ceiling" 
                            data={globalFrontierPoints.points.map(p => ({ ...p, isGlobal: true }))} 
                            fill="#52525b" 
                            line={{ stroke: '#3f3f46', strokeWidth: 1.5, strokeDasharray: '6 4' }} 
                            shape={() => null}
                            isAnimationActive={false} 
                        />

                        {/* Local Portfolio Frontier */}
                        <Scatter 
                            name="Local Portfolio Ceiling" 
                            data={frontierPoints.points} 
                            fill="#10b981" 
                            line={{ stroke: '#10b981', strokeWidth: 2.5 }} 
                            shape={() => null}
                            isAnimationActive={false} 
                        />

                        {/* Delta X and Y Reference Lines - Moved before Scatters to ensure they stay behind if needed, but Recharts layers by order. 
                            Actually, we want them on top, so we keep them here or after. */}
                        {hoveredDot && (
                            <>
                                <ReferenceLine 
                                    segment={[{ x: hoveredDot.vol, y: hoveredDot.return }, { x: hoveredDot.vol, y: findOptimalReturnAtRisk(frontierPoints.points, hoveredDot.vol) }]} 
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    strokeDasharray="4 4" 
                                    style={{ pointerEvents: 'none' }}
                                />
                                <ReferenceLine 
                                    segment={[{ x: hoveredDot.vol, y: hoveredDot.return }, { x: coordinates.target.vol, y: hoveredDot.return }]} 
                                    stroke="#f43f5e"
                                    strokeWidth={2}
                                    strokeDasharray="4 4" 
                                    style={{ pointerEvents: 'none' }}
                                />
                            </>
                        )}

                        <Scatter name="Portfolios" data={data} isAnimationActive={false}>
                            {data.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={entry.fill} 
                                    strokeWidth={index === 1 ? 4 : 0} 
                                    stroke={entry.fill} 
                                    strokeOpacity={0.2} 
                                    onMouseEnter={() => setHoveredDot(entry)}
                                    onMouseLeave={() => setHoveredDot(null)}
                                />
                            ))}
                        </Scatter>

                        {trailData.length > 0 && (
                            <Scatter
                                name="Snapshots"
                                data={trailData}
                                isAnimationActive={false}
                            >
                                {trailData.map((entry, index) => (
                                    <Cell 
                                        key={`trail-${index}`} 
                                        fill="#f59e0b" 
                                        fillOpacity={0.7} 
                                        onMouseEnter={() => setHoveredDot(entry)}
                                        onMouseLeave={() => setHoveredDot(null)}
                                    />
                                ))}
                            </Scatter>
                        )}
                    </ScatterChart>
                </ResponsiveContainer>
                
                {/* Clean, Non-Colliding Legend */}
                <div className="absolute top-2 left-2 flex flex-col gap-1 text-[8px] font-black uppercase tracking-[0.2em] bg-black/80 p-3 border border-zinc-900 rounded-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-white" /> 
                        <span className="text-zinc-400">Market (VTI)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#6366f1]" /> 
                        <span className="text-zinc-400">Strategy (Target)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#fb7185]" /> 
                        <span className="text-zinc-400">Portfolio (Actual)</span>
                    </div>
                </div>

                <div className="absolute top-2 right-2 ui-caption text-zinc-500/60 flex flex-col items-end gap-2 pr-4 pt-4 text-[8px] uppercase font-black tracking-widest">
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-[1px] border-t-2 border-dashed border-zinc-600" />
                        Global Strategic Ceiling
                    </div>
                    <div className="flex items-center gap-2 text-emerald-500/60">
                        <span className="w-8 h-[2px] bg-emerald-500/60" />
                        Local Portfolio Ceiling
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                <div className="space-y-6">
                    <div className="text-ui-header text-truth border-b border-zinc-900/50 pb-4">Efficiency De-composition</div>
                    <div className="space-y-10">
                        <div className="space-y-2">
                            <div className="ui-caption text-risk font-bold uppercase">Selection Error</div>
                            <div className="ui-metric text-risk">-{Math.abs(Math.round(selectionError * 1000) / 10)}% <span className="ui-label text-meta lowercase ml-2 font-normal text-[10px]">Universe Drag</span></div>
                            <p className="ui-value text-meta leading-relaxed italic text-[11px]">
                                The gap between your choice of assets and the broad market. You are missing potential yield due to asset class omission.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="ui-caption text-amber-500 font-bold uppercase">Execution Error</div>
                            <div className="ui-metric text-amber-500">-{Math.abs(Math.round(executionError * 1000) / 10)}% <span className="ui-label text-meta lowercase ml-2 font-normal text-[10px]">Weighting Drag</span></div>
                            <p className="ui-value text-meta leading-relaxed italic text-[11px]">
                                Internal friction from sub-optimal weights. You are taking uncompensated risk compared to the best possible mix of your current assets.
                            </p>
                        </div>

                        <div className="bg-accent/5 border border-accent/20 p-6 space-y-3">
                            <div className="ui-caption text-accent font-black">Strategic Verdict</div>
                            <p className="ui-value text-truth font-bold leading-relaxed text-[13px]">
                                Your total efficiency gap is **{(totalEfficiencyGap * 100).toFixed(1)}%**. 
                                {selectionError > executionError 
                                    ? " Your primary bottleneck is Asset Selection." 
                                    : " Your primary bottleneck is Portfolio Weighting."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
