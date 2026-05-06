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
    Cell
} from 'recharts';
import { Coordinates } from '@/lib/types/audit';

interface ChartPoint {
    vol: number;
    return: number;
    label?: string | null;
    isCurve?: boolean;
    isGlobal?: boolean;
    isTrail?: boolean;
    fill?: string;
    size?: number;
}

interface Props {
    coordinates: {
        vti: Coordinates;
        target: Coordinates;
        actual: Coordinates;
    };
    snapshotTrail: { date: string; label: string | null; return: number; vol: number }[];
    frontierPoints: {
        points: ChartPoint[];
        cloud: ChartPoint[];
    };
    globalFrontierPoints: {
        points: ChartPoint[];
    };
}

const findOptimalReturnAtRisk = (points: ChartPoint[], targetVol: number) => {
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

const CustomTooltip = ({ active, payload, localPoints, targetVol }: { active?: boolean; payload?: any[]; localPoints: ChartPoint[]; targetVol: number }) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload as ChartPoint;
        const toPct = (v: number) => `${(v * 100).toFixed(1)}%`;
        const labelStr = d.label || (d.isGlobal ? 'Strategic Global Frontier' : (d.isCurve ? 'Local Portfolio Frontier' : (d.isTrail ? 'Historical Snapshot' : 'Simulated Portfolio')));
        
        let dragSection = null;
        if (!d.isCurve && !d.isGlobal) {
            const optimalReturn = findOptimalReturnAtRisk(localPoints, d.vol);
            const returnDrag = d.return - optimalReturn;
            const riskDrag = d.vol - targetVol;
            
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
    const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
    
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
            isTrail: true
        })),
    [snapshotTrail]);

    const actualVol = coordinates.actual.vol;
    const localCeiling = useMemo(() => findOptimalReturnAtRisk(frontierPoints.points, actualVol), [frontierPoints.points, actualVol]);
    const globalCeiling = useMemo(() => findOptimalReturnAtRisk(globalFrontierPoints.points, actualVol), [globalFrontierPoints.points, actualVol]);
    
    const executionError = localCeiling - coordinates.actual.return;
    const selectionError = globalCeiling - localCeiling;
    const totalEfficiencyGap = globalCeiling - coordinates.actual.return;

    const targetVol = coordinates.target.vol;
    const planHistoricalGap = useMemo(() => {
        const ceiling = findOptimalReturnAtRisk(globalFrontierPoints.points, targetVol);
        return ceiling - coordinates.target.return;
    }, [globalFrontierPoints.points, targetVol, coordinates.target.return]);

    if (!mounted) return null;

    return (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-20">
            <div className="xl:col-span-3 aspect-video min-h-[500px] relative border border-zinc-900/50 bg-black/20 rounded-sm overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart 
                        margin={{ top: 80, right: 40, bottom: 60, left: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                        <XAxis type="number" dataKey="vol" name="Risk" unit="%" domain={[0, 0.25]} stroke="#3f3f46" fontSize={10} tickFormatter={(v) => (v * 100).toFixed(0)} label={{ value: 'ANNUALIZED VOLATILITY (RISK)', position: 'bottom', fill: '#52525b', fontSize: 9, fontWeight: 700, offset: 20 }} />
                        <YAxis type="number" dataKey="return" name="Return" unit="%" domain={[0, 0.15]} stroke="#3f3f46" fontSize={10} tickFormatter={(v) => (v * 100).toFixed(0)} label={{ value: 'ANNUALIZED RETURN (REWARD)', angle: -90, position: 'left', fill: '#52525b', fontSize: 9, fontWeight: 700, offset: 10 }} />
                        
                        {/* 1. Cloud */}
                        <Scatter 
                            name="Local Opportunity Set" 
                            data={frontierPoints.cloud} 
                            fill="#10b981" 
                            fillOpacity={0.02} 
                            shape="circle" 
                            isAnimationActive={false} 
                        />
                        
                        {/* 2. Frontier Lines */}
                        <Scatter 
                            name="Global Strategic Ceiling" 
                            data={globalFrontierPoints.points.map(p => ({ ...p, isGlobal: true }))} 
                            fill="#52525b" 
                            line={{ stroke: '#27272a', strokeWidth: 1.5, strokeDasharray: '6 4' }} 
                            shape={() => null}
                            isAnimationActive={false} 
                        />
                        <Scatter 
                            name="Local Portfolio Ceiling" 
                            data={frontierPoints.points.map(p => ({ ...p, isCurve: true }))} 
                            fill="#10b981" 
                            line={{ stroke: '#10b981', strokeWidth: 2 }} 
                            shape={() => null}
                            isAnimationActive={false} 
                        />

                        {/* 3. Snapshots */}
                        <Scatter name="Snapshots" data={trailData} isAnimationActive={false}>
                            {trailData.map((entry, index) => (
                                <Cell 
                                    key={`trail-${index}`} 
                                    fill="#f59e0b" 
                                    fillOpacity={0.7} 
                                    onMouseEnter={() => setHoveredPoint(entry)}
                                    onMouseLeave={() => setHoveredPoint(null)}
                                />
                            ))}
                        </Scatter>

                        {/* 4. Portfolios */}
                        <Scatter name="Portfolios" data={data} isAnimationActive={false}>
                            {data.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={entry.fill} 
                                    strokeWidth={index === 1 ? 4 : 0} 
                                    stroke={entry.fill} 
                                    strokeOpacity={0.2} 
                                    onMouseEnter={() => setHoveredPoint(entry)}
                                    onMouseLeave={() => setHoveredPoint(null)}
                                />
                            ))}
                        </Scatter>

                        {/* 5. DELTA VECTORS */}
                        {hoveredPoint && (
                            <>
                                <Scatter
                                    isAnimationActive={false}
                                    data={[
                                        { vol: hoveredPoint.vol, return: hoveredPoint.return },
                                        { vol: hoveredPoint.vol, return: findOptimalReturnAtRisk(frontierPoints.points, hoveredPoint.vol) }
                                    ]}
                                    line={{ stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '6 6' }}
                                    shape={() => null}
                                />
                                <Scatter
                                    isAnimationActive={false}
                                    data={[
                                        { vol: coordinates.target.vol, return: hoveredPoint.return },
                                        { vol: hoveredPoint.vol, return: hoveredPoint.return }
                                    ]}
                                    line={{ stroke: '#f43f5e', strokeWidth: 2, strokeDasharray: '6 6' }}
                                    shape={() => null}
                                />
                            </>
                        )}
                        <Tooltip cursor={false} content={<CustomTooltip localPoints={frontierPoints.points} targetVol={coordinates.target.vol} />} />
                    </ScatterChart>
                </ResponsiveContainer>
                
                {/* HUD Elements - Repositioned to avoid sidebar collision */}
                <div className="absolute top-4 left-6 flex flex-col gap-1.5 text-[8px] font-black uppercase tracking-[0.2em] bg-black/60 backdrop-blur-md p-4 border border-zinc-900 rounded-sm pointer-events-none z-20">
                    <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.3)]" /> 
                        <span className="text-zinc-400">Market (VTI)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1] shadow-[0_0_8px_rgba(99,102,241,0.3)]" /> 
                        <span className="text-zinc-400">Strategy (Target)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#fb7185] shadow-[0_0_8px_rgba(251,113,133,0.3)]" /> 
                        <span className="text-zinc-400">Portfolio (Actual)</span>
                    </div>
                </div>

                <div className="absolute top-4 right-6 ui-caption text-zinc-500/60 flex flex-col items-end gap-2 text-[8px] uppercase font-black tracking-widest pointer-events-none z-20 bg-black/40 backdrop-blur-sm p-3 rounded-sm border border-zinc-900/30">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-[1px] border-t border-dashed border-zinc-600" />
                        Global Strategic Ceiling
                    </div>
                    <div className="flex items-center gap-3 text-emerald-500/60">
                        <span className="w-10 h-[2px] bg-emerald-500/60" />
                        Local Portfolio Ceiling
                    </div>
                </div>
            </div>

            <div className="xl:col-span-1 space-y-16 pl-4 border-l border-zinc-900/30">
                <div className="space-y-10">
                    <div className="space-y-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Diagnostics</div>
                        <h3 className="text-xl font-black tracking-tighter uppercase text-white leading-tight">Efficiency<br/>De-composition</h3>
                    </div>
                    
                    <div className="space-y-12">
                        <div className="space-y-3">
                            <div className="text-risk font-bold uppercase tracking-widest text-[9px]">Selection Error</div>
                            <div className="text-3xl font-black text-risk tracking-tighter">-{Math.abs(Math.round((globalCeiling - localCeiling) * 1000) / 10)}%</div>
                            <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Universe Drag</div>
                            <p className="text-zinc-500 leading-relaxed italic text-[11px] pt-1 border-t border-zinc-900/50">
                                Gap between current assets and broad market potential. Missed yield due to asset class omission.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="text-amber-500 font-bold uppercase tracking-widest text-[9px]">Wrong Asset Mix (Historical)</div>
                            <div className="text-3xl font-black text-amber-500 tracking-tighter">-{Math.abs(Math.round((localCeiling - coordinates.actual.return) * 1000) / 10)}%</div>
                            <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Weighting Drag</div>
                            <p className="text-zinc-500 leading-relaxed italic text-[11px] pt-1 border-t border-zinc-900/50">
                                The money you lose on average every year because your plan's percentages are mathematically imperfect.
                            </p>
                        </div>

                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 space-y-4 rounded-sm">
                            <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Strategic Verdict</div>
                            <p className="text-zinc-300 font-bold leading-snug text-[13px]">
                                Your plan is mathematically solid (only <span className="text-white">{(planHistoricalGap * 100).toFixed(1)}%</span> historical gap), 
                                but you had a rough year (<span className="text-white">4.9%</span> actual gap).
                                <span className="block mt-2 text-zinc-500 font-normal italic">
                                    You aren't just 'weighted wrong'—you're currently being punished by specific market conditions.
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
