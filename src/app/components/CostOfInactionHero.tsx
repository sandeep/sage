'use client';
import { usePrivacy } from './PrivacyContext';

interface TileProps {
    id: string;
    label: string;
    dollars: number | null;
    bps: number | null;
    callToAction: string;
    privacy: boolean;
}

function Tile({ id, label, dollars, bps, callToAction, privacy }: TileProps) {
    const severity = (bps ?? 0) > 25 ? 'rose' : (bps ?? 0) > 10 ? 'amber' : 'emerald';
    const borderColor = severity === 'rose' ? 'border-rose-900' : severity === 'amber' ? 'border-amber-900' : 'border-emerald-900';
    const textColor   = severity === 'rose' ? 'text-rose-400'  : severity === 'amber' ? 'text-amber-400'  : 'text-emerald-400';

    const displayDollars = dollars != null ? `$${Math.round(dollars).toLocaleString()} / yr` : '—';
    const displayBps = bps != null ? `${bps.toFixed(0)} bps` : '—';

    return (
        <button
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`flex-1 bg-zinc-950 border ${borderColor} rounded-sm p-6 text-left hover:bg-zinc-900/40 transition-colors group`}
        >
            <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">{label}</div>
            <div className={`text-2xl font-black ${textColor} mb-1`}>
                {privacy ? <span className="opacity-40 italic font-medium tracking-tighter">$ **,***</span> : displayDollars}
            </div>
            <div className="text-xs text-zinc-600">{displayBps}</div>
            <div className="text-xs text-zinc-700 mt-3 group-hover:text-zinc-500 transition-colors">
                {callToAction} →
            </div>
        </button>
    );
}

interface Props {
    taxDragDollars: number | null;
    taxDragBps: number | null;
    taxIssueCount: number | null;
    feeDragDollars: number | null;
    feeDragBps: number | null;
    feeIssueCount: number | null;
    allocationGapDollars: number | null;
    allocationGapCagrDelta: number | null;
    portfolioValue: number;
    accountCount: number;
    latestPriceDate: string | null;
}

export default function CostOfInactionHero({
    taxDragDollars, taxDragBps, taxIssueCount,
    feeDragDollars, feeDragBps, feeIssueCount,
    allocationGapDollars, allocationGapCagrDelta,
    portfolioValue, accountCount, latestPriceDate,
}: Props) {
    const { privacy } = usePrivacy();
    const totalDrag = (taxDragDollars ?? 0) + (feeDragDollars ?? 0) + (allocationGapDollars ?? 0);

    const formattedValue = privacy 
        ? <span className="opacity-40 italic font-medium tracking-tighter">$ *,***,***</span>
        : `$${Math.round(portfolioValue).toLocaleString()}`;

    return (
        <div className="bg-zinc-950 border border-zinc-900 rounded-sm p-8 space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">
                        Total Annual Loss
                    </div>
                    <div className="text-4xl font-black text-white">
                        {privacy
                            ? <span className="opacity-20 italic font-medium tracking-tighter">$ **,*** / yr</span>
                            : (taxDragDollars == null && feeDragDollars == null && allocationGapDollars == null)
                                ? '—'
                                : `$${Math.round(totalDrag).toLocaleString()} / yr`
                        }
                    </div>
                    <div className="text-xs text-zinc-600 mt-1">
                        tax placement · fund costs · allocation drift
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-1">
                        Analyzing
                    </div>
                    <div className="text-sm font-black text-zinc-300">
                        {formattedValue}
                    </div>
                    <div className="text-xs text-zinc-600 mt-1 uppercase tracking-tighter">
                        Across {accountCount} Accounts · {latestPriceDate ? `Prices as of ${latestPriceDate}` : 'No price data'}
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="flex-1 relative group">
                    <Tile
                        id="zone-overpaying-tax"
                        label="Tax Leakage"
                        dollars={taxDragDollars}
                        bps={taxDragBps}
                        callToAction={(taxIssueCount ?? 0) > 0 ? `${taxIssueCount} moves fix it` : 'Optimized'}
                        privacy={privacy}
                    />
                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="relative">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-zinc-700 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-zinc-900 border border-zinc-800 rounded shadow-xl text-xs text-zinc-400 font-sans leading-relaxed pointer-events-none translate-y-1 group-hover:translate-y-0 transition-transform">
                                Estimated by multiplying basis points of tax leakage (high-yield assets in taxable accounts) by total account values.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 relative group">
                    <Tile
                        id="zone-overpaying-fees"
                        label="Fee Drag"
                        dollars={feeDragDollars}
                        bps={feeDragBps}
                        callToAction={(feeIssueCount ?? 0) > 0 ? `${feeIssueCount} swaps fix it` : 'Optimized'}
                        privacy={privacy}
                    />
                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="relative">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-zinc-700 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-zinc-900 border border-zinc-800 rounded shadow-xl text-xs text-zinc-400 font-sans leading-relaxed pointer-events-none translate-y-1 group-hover:translate-y-0 transition-transform">
                                Estimated by multiplying basis points of excess expense ratio (relative to cheaper benchmarks) by total fund values.
                            </div>
                        </div>
                    </div>
                </div>

                <Tile
                    id="zone-allocation-gap"
                    label="Allocation Gap"
                    dollars={allocationGapDollars}
                    bps={allocationGapCagrDelta !== null ? Math.round(allocationGapCagrDelta * 10000) : null}
                    callToAction={allocationGapCagrDelta !== null
                        ? `+${(allocationGapCagrDelta * 100).toFixed(2)}% CAGR if on target`
                        : 'See breakdown'}
                    privacy={privacy}
                />
            </div>
        </div>
    );
}

