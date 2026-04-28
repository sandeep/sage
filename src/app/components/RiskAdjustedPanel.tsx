'use client';
import { usePrivacy } from './PrivacyContext';

interface PerformanceSnapshot {
    return1y: number | null;
    annualizedVol: number | null;
    sharpe: number | null;
    sortino: number | null;
    beta: number | null;
    maxDrawdown: number | null;
    expectedCagr: number | null;
}

interface Props {
    current: PerformanceSnapshot | null;
    target: PerformanceSnapshot | null;
    vti: PerformanceSnapshot | null;
    proposed: PerformanceSnapshot | null;
    betaAdjustedExpected: number | null;
    verdict: string;
}

function fmt(v: number | null, mult = 100, suffix = '%', dec = 1): string {
    if (v === null || v === undefined) return '—';
    return (v * mult).toFixed(dec) + suffix;
}

function fmtDelta(v: number | null, mult = 100, suffix = '%', dec = 1): { text: string; color: string } {
    if (v === null || v === undefined) return { text: '—', color: 'text-zinc-600' };
    const val = v * mult;
    const text = (val >= 0 ? '+' : '') + val.toFixed(dec) + suffix;
    return { text, color: val > 0 ? 'text-emerald-400' : val < 0 ? 'text-rose-400' : 'text-zinc-500' };
}

function fmtVolDelta(v: number | null): { text: string; color: string } {
    // For vol/drawdown: negative delta (less vol) = good = emerald
    if (v === null || v === undefined) return { text: '—', color: 'text-zinc-600' };
    const val = v * 100;
    const text = (val >= 0 ? '+' : '') + val.toFixed(1) + '%';
    return { text, color: val < 0 ? 'text-emerald-400' : val > 0 ? 'text-rose-400' : 'text-zinc-500' };
}

const ROWS: {
    label: string;
    key: keyof PerformanceSnapshot;
    format: (v: number | null) => string;
    deltaFn: (delta: number | null) => { text: string; color: string };
    note?: string;
}[] = [
    { label: '1Y Return',    key: 'return1y',      format: v => fmt(v), deltaFn: fmtDelta },
    { label: 'Volatility',   key: 'annualizedVol',  format: v => fmt(v), deltaFn: fmtVolDelta },
    { label: 'Sharpe',       key: 'sharpe',         format: v => fmt(v, 1, '', 2), deltaFn: d => fmtDelta(d, 1, '', 2) },
    { label: 'Sortino',      key: 'sortino',        format: v => fmt(v, 1, '', 2), deltaFn: d => fmtDelta(d, 1, '', 2) },
    { label: 'Beta',         key: 'beta',           format: v => fmt(v, 1, '', 2), deltaFn: fmtVolDelta },
    { label: 'Max Drawdown', key: 'maxDrawdown',    format: v => fmt(v), deltaFn: fmtVolDelta },
    { label: 'Exp CAGR †',  key: 'expectedCagr',   format: v => fmt(v), deltaFn: fmtDelta, note: '† Forward-looking estimate based on asset class premiums.' },
];

export default function RiskAdjustedPanel({ current, target, vti, proposed, betaAdjustedExpected, verdict }: Props) {
    const { privacy } = usePrivacy();
    const showProposed = proposed !== null;

    const isCompensated = betaAdjustedExpected !== null && current?.return1y !== null && current?.return1y !== undefined
        ? current.return1y >= betaAdjustedExpected
        : null;

    return (
        <div className="bg-zinc-950 border border-zinc-900 rounded-sm p-8 space-y-8">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                Risk-Adjusted Performance
            </h2>

            {/* Uncompensated Risk */}
            <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-widest text-zinc-600">
                    Uncompensated Risk
                </div>
                {betaAdjustedExpected !== null && current?.return1y !== null && current?.return1y !== undefined ? (
                    <div className={`text-sm font-black ${isCompensated ? 'text-emerald-400' : 'text-rose-400'}`}>
                        Beta-adjusted expected: {fmt(betaAdjustedExpected)} · Actual: {fmt(current.return1y)} · {isCompensated ? '+' : ''}{fmt((current.return1y - betaAdjustedExpected), 100, '%', 1)} alpha {isCompensated ? '✓' : '✗'}
                    </div>
                ) : (
                    <div className="text-zinc-600 text-sm">Insufficient data</div>
                )}
                <div className="text-xs text-zinc-600 italic">{verdict}</div>
            </div>

            {/* Delta table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                        <tr className="border-b border-zinc-900">
                            <th className="py-2 pr-6 text-xs font-black uppercase tracking-widest text-zinc-600 w-1/4"></th>
                            <th className="py-2 px-4 text-right text-xs font-black uppercase tracking-widest text-zinc-300">Current</th>
                            <th className="py-2 px-4 text-right text-xs font-black uppercase tracking-widest text-zinc-500">Δ Target</th>
                            {showProposed && (
                                <th className="py-2 px-4 text-right text-xs font-black uppercase tracking-widest text-zinc-500">Δ Proposed</th>
                            )}
                            <th className="py-2 px-4 text-right text-xs font-black uppercase tracking-widest text-zinc-500">Δ VTI</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/50">
                        {ROWS.map(row => {
                            const cur = current ? current[row.key] as number | null : null;
                            const tgt = target ? target[row.key] as number | null : null;
                            const vtiVal = vti ? vti[row.key] as number | null : null;
                            const prop = proposed ? proposed[row.key] as number | null : null;

                            const dTarget   = cur !== null && tgt     !== null ? tgt     - cur : null;
                            const dVti      = cur !== null && vtiVal  !== null ? vtiVal  - cur : null;
                            const dProposed = cur !== null && prop    !== null ? prop    - cur : null;


                            const dtgt  = row.deltaFn(dTarget);
                            const dvti  = row.deltaFn(dVti);
                            const dprop = row.deltaFn(dProposed);

                            return (
                                <tr key={row.key} className="group hover:bg-zinc-900/20">
                                    <td className="py-3 pr-6 text-zinc-500 uppercase tracking-widest text-xs font-black">
                                        {row.label}
                                    </td>
                                    <td className="py-3 px-4 text-right font-black text-zinc-200">
                                        {row.key === 'expectedCagr' && privacy
                                            ? <span className="tracking-widest text-zinc-600">•••</span>
                                            : row.format(cur)}
                                    </td>
                                    <td className={`py-3 px-4 text-right font-black ${dtgt.color}`}>{dtgt.text}</td>
                                    {showProposed && (
                                        <td className={`py-3 px-4 text-right font-black ${dprop.color}`}>{dprop.text}</td>
                                    )}
                                    <td className={`py-3 px-4 text-right font-black ${dvti.color}`}>{dvti.text}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {ROWS.filter(r => r.note).map(r => (
                <div key={r.key} className="text-xs text-zinc-700 italic">{r.note}</div>
            ))}

            {showProposed && (
                <div className="text-xs text-zinc-700">Δ Proposed reflects draft allocation loaded from the Allocation editor.</div>
            )}
        </div>
    );
}
