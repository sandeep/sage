'use client';
import React from 'react';

interface CalendarHeatmapProps {
    years: number[];
    vti: Record<number, number>;
    actual: Record<number, number> | null;
    target: Record<number, number> | null;
    proposed: Record<number, number> | null;
}

function cellBg(value: number): string {
    const opacity = Math.min(Math.abs(value) / 0.40, 1.0) * 0.75;
    return value >= 0
        ? `rgba(16,185,129,${opacity.toFixed(3)})`
        : `rgba(239,68,68,${opacity.toFixed(3)})`;
}

function fmtReturn(v: number): string {
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

function fmtDelta(v: number): string {
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

export default function CalendarHeatmap({
    years, vti, actual, target, proposed,
}: CalendarHeatmapProps) {
    const showProposed = proposed !== null;
    const deltaCols = (actual !== null ? 1 : 0) + 1 + (showProposed ? 1 : 0);

    return (
        <div style={{ overflowX: 'auto' }}>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `48px 80px repeat(${deltaCols}, 1fr)`,
                    gap: '2px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    minWidth: '420px',
                }}
            >
                {/* Headers */}
                <div />
                <div style={{ padding: '4px 6px', fontWeight: 700, color: '#71717a' }}>VTI</div>
                {actual !== null && (
                    <div style={{ padding: '4px 6px', fontWeight: 700, color: '#10b981' }}>Actual Δ</div>
                )}
                <div style={{ padding: '4px 6px', fontWeight: 700, color: '#6366f1' }}>Target Δ</div>
                {showProposed && (
                    <div style={{ padding: '4px 6px', fontWeight: 700, color: '#f59e0b' }}>Proposed Δ</div>
                )}

                {/* Rows */}
                {[...years].reverse().map(year => {
                    const vtiReturn   = vti[year];
                    const actReturn   = actual?.[year];
                    const tgtReturn   = target?.[year];
                    const propReturn  = proposed?.[year];

                    if (vtiReturn === undefined) return null;

                    return (
                        <React.Fragment key={year}>
                            {/* Year label */}
                            <div style={{ color: '#52525b', display: 'flex', alignItems: 'center', padding: '2px 0' }}>
                                {year}
                            </div>

                            {/* VTI raw return */}
                            <div style={{
                                background: cellBg(vtiReturn),
                                borderRadius: '3px',
                                padding: '5px 8px',
                                fontWeight: 700,
                                color: vtiReturn >= 0 ? '#d1fae5' : '#fee2e2',
                            }}>
                                {fmtReturn(vtiReturn)}
                            </div>

                            {/* Actual delta */}
                            {actual !== null && (
                                <div style={{
                                    background: actReturn !== undefined ? cellBg(actReturn - vtiReturn) : 'transparent',
                                    borderRadius: '3px',
                                    padding: '5px 8px',
                                    fontWeight: 700,
                                    color: actReturn !== undefined
                                        ? (actReturn - vtiReturn >= 0 ? '#86efac' : '#fca5a5')
                                        : '#3f3f46',
                                }}>
                                    {actReturn !== undefined ? fmtDelta(actReturn - vtiReturn) : '—'}
                                </div>
                            )}

                            {/* Target delta */}
                            <div style={{
                                background: tgtReturn !== undefined ? cellBg(tgtReturn - vtiReturn) : 'transparent',
                                borderRadius: '3px',
                                padding: '5px 8px',
                                fontWeight: 700,
                                color: tgtReturn !== undefined
                                    ? (tgtReturn - vtiReturn >= 0 ? '#86efac' : '#fca5a5')
                                    : '#3f3f46',
                            }}>
                                {tgtReturn !== undefined ? fmtDelta(tgtReturn - vtiReturn) : '—'}
                            </div>

                            {/* Proposed delta */}
                            {showProposed && (
                                <div style={{
                                    background: propReturn !== undefined ? cellBg(propReturn - vtiReturn) : 'transparent',
                                    borderRadius: '3px',
                                    padding: '5px 8px',
                                    fontWeight: 700,
                                    color: propReturn !== undefined
                                        ? (propReturn - vtiReturn >= 0 ? '#86efac' : '#fca5a5')
                                        : '#3f3f46',
                                }}>
                                    {propReturn !== undefined ? fmtDelta(propReturn - vtiReturn) : '—'}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
