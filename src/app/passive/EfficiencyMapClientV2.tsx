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
    driftDrag1Y: number;
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
                            <div className="ui-caption text-zinc-500 flex items-center gap-1">
                                <span className="w-2 h-[2px] bg-amber-500 inline-block" /> Return Drag (ΔY)
                            </div>
                            <div className="text-amber-500 font-bold ui-label lowercase">{toPct(returnDrag)} <span className="text-zinc-600 font-normal ml-1 lowercase italic">vs {toPct(optimalReturn)} ceiling</span></div>
                        </div>
                        <div>
                            <div className="ui-caption text-zinc-500 flex items-center gap-1">
                                <span className="w-2 h-[2px] bg-rose-500 inline-block" /> Risk Excess (ΔX)
                            </div>
                            <div className="text-rose-500 font-bold ui-label lowercase">{(riskDrag > 0 ? '+' : '')}{toPct(riskDrag)} <span className="text-zinc-600 font-normal ml-1 lowercase italic">vs {toPct(targetVol)} target</span></div>
                        </div>
                    </div>
                );
            }
        }

        return (
            <div className="bg-card border border-zinc-900/50 p-4 shadow-2xl space-y-2 relative z-50">
                <div className="ui-label text-white border-b border-zinc-900/50 pb-1">{labelStr}</div>
                <div className="ui-body text-zinc-400">Return (CAGR): <span className="text-white">{toPct(d.return)}</span></div>
                <div className="ui-body text-zinc-400">Risk (Volatility): <span className="text-white">{toPct(d.vol)}</span></div>
                {dragSection}
                <div className="ui-caption mt-2 italic">
                    {d.isGlobal ? 'Market Ceiling' : d.isCurve ? 'Current Asset Ceiling' : d.isTrail ? 'Historical State' : 'Asset Mix Variation'}
                </div>
            </div>
        );
    }
    return null;
};

export default function EfficiencyMapClientV2({ coordinates, snapshotTrail, frontierPoints, globalFrontierPoints, driftDrag1Y }: Props) {
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

    if (!mounted) return null;

    return (
        <div className="space-y-12">
            {/* Chart Area */}
            <div className="aspect-video min-h-[500px] relative border border-zinc-900/50 bg-black/20 rounded-sm overflow-hidden">
                <ResponsiveContainer width="100%" height="100%" minHeight={500}>
                    <ScatterChart 
                        margin={{ top: 80, right: 40, bottom: 60, left: 20 }}
                        onMouseMove={(e: any) => {
                            if (e && e.activePayload && e.activePayload.length > 0) {
                                const p = e.activePayload[0].payload as ChartPoint;
                                if (!p.isCurve && !p.isGlobal) {
                                    setHoveredPoint(p);
                                } else {
                                    setHoveredPoint(null);
                                }
                            } else {
                                setHoveredPoint(null);
                            }
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                        <XAxis 
                            type="number" 
                            dataKey="vol" 
                            name="Risk" 
                            unit="%" 
                            domain={[0, 0.25]} 
                            stroke="#3f3f46" 
                            fontSize={10} 
                            style={{ fontFamily: 'var(--font-mono)' }}
                            tickFormatter={(v) => (v * 100).toFixed(0)} 
                            label={{ value: 'ANNUALIZED VOLATILITY (RISK)', position: 'bottom', fill: '#52525b', fontSize: 10, fontWeight: 700, offset: 20, style: { fontFamily: 'var(--font-mono)' } }} 
                        />
                        <YAxis 
                            type="number" 
                            dataKey="return" 
                            name="Return" 
                            unit="%" 
                            domain={[0, 0.15]} 
                            stroke="#3f3f46" 
                            fontSize={10} 
                            style={{ fontFamily: 'var(--font-mono)' }}
                            tickFormatter={(v) => (v * 100).toFixed(0)} 
                            label={{ value: 'ANNUALIZED RETURN (REWARD)', angle: -90, position: 'left', fill: '#52525b', fontSize: 10, fontWeight: 700, offset: 10, style: { fontFamily: 'var(--font-mono)' } }} 
                        />
                        
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
                <div className="absolute top-4 left-6 flex flex-col gap-1.5 ui-caption bg-black/60 backdrop-blur-md p-4 border border-zinc-900 rounded-sm pointer-events-none z-20">
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

                <div className="absolute top-4 right-6 ui-caption text-zinc-500/60 flex flex-col items-end gap-2 pointer-events-none z-20 bg-black/40 backdrop-blur-sm p-3 rounded-sm border border-zinc-900/30">
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

            {/* Diagnostics Underneath (Down-scaled to 11px/13px) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-zinc-900/30">
                <div className="space-y-4">
                    <div className="flex items-baseline gap-3">
                        <div className="ui-label text-risk">Selection Error</div>
                        <div className="ui-value font-bold text-white">-{Math.abs(Math.round((globalCeiling - localCeiling) * 1000) / 10)}%</div>
                    </div>
                    <p className="ui-caption text-zinc-500 normal-case leading-relaxed">
                        Gap between current assets and broad market potential. Missed yield due to asset class omission.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-baseline gap-3">
                        <div className="ui-label text-amber-500">Wrong Asset Mix (Historical)</div>
                        <div className="ui-value font-bold text-white">-{Math.abs(Math.round((localCeiling - coordinates.actual.return) * 1000) / 10)}%</div>
                    </div>
                    <p className="ui-caption text-zinc-500 normal-case leading-relaxed">
                        The money you lose on average every year because your plan's percentages are mathematically imperfect.
                    </p>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-sm">
                    <div className="ui-label text-emerald-500 mb-2 !text-[9px]">Strategic Verdict</div>
                    <div className="ui-caption text-zinc-300 normal-case leading-relaxed">
                        Your plan's weighting is mathematically strong (only <span className="text-white font-bold">{(executionError * 100).toFixed(1)}%</span> historical gap), 
                        but you had a rough year (<span className="text-white font-bold">{(driftDrag1Y * 100).toFixed(1)}%</span> actual gap).
                        <span className="block mt-2 text-zinc-500 italic text-[9px] uppercase tracking-tighter">
                            You aren't just 'weighted wrong'—you're being punished by specific market conditions.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
