
import React from 'react';
import Link from 'next/link';
import { generateAuditReport } from '@/lib/logic/auditEngine';

const fmtUSD = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal >= 1_000_000) return '$' + (absVal / 1_000_000).toFixed(2) + 'M';
    if (absVal >= 1_000) return '$' + (absVal / 1_000).toFixed(1) + 'k';
    return '$' + Math.round(absVal);
};

export default async function StructuralCostCenter() {
    const report = await generateAuditReport();
    const { efficiency, tv, feeRisks, taxIssues } = report;

    const feeLoss = (efficiency.expenseDragBps / 10000) * tv;
    const taxLoss = (efficiency.locationDragBps / 10000) * tv;
    const totalLoss = feeLoss + taxLoss;

    return (
        <section id="cost-center" className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* 1. EXCESS FUND FEES */}
                <div className="card space-y-6 shadow-2xl border-zinc-900 bg-zinc-950/50 p-8 h-full">
                    <div className="flex justify-between items-baseline border-b border-zinc-900 pb-4">
                        <h2 className="text-ui-label text-zinc-500 uppercase tracking-widest">Excess Fund Fees</h2>
                        <div className="text-ui-data text-white">{efficiency.expenseDragBps.toFixed(1)} <span className="ui-caption text-zinc-600 ml-1">bps</span></div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-ui-data font-bold text-zinc-100">-{fmtUSD(feeLoss)} <span className="ui-caption text-zinc-600 ml-2">per year</span></div>
                        <div className="text-ui-caption text-zinc-500 uppercase tracking-widest">Structural Choice Premium</div>
                    </div>
                </div>

                {/* 2. TAX INEFFICIENCY */}
                <div className="card space-y-6 shadow-2xl border-zinc-900 bg-zinc-950/50 p-8 h-full">
                    <div className="flex justify-between items-baseline border-b border-zinc-900 pb-4">
                        <h2 className="text-ui-label text-zinc-500 uppercase tracking-widest">Tax Inefficiency</h2>
                        <div className="text-ui-data text-white">{efficiency.locationDragBps.toFixed(1)} <span className="ui-caption text-zinc-600 ml-1">bps</span></div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-ui-data font-bold text-zinc-100">-{fmtUSD(taxLoss)} <span className="text-ui-caption text-zinc-600 ml-2">per year</span></div>
                        <div className="text-ui-caption text-zinc-500 uppercase tracking-widest">Avoidable Dividend Erosion</div>
                    </div>
                </div>

                {/* 3. TOTAL ANNUAL COST (The Conclusion) */}
                <div className="card space-y-6 shadow-2xl border-rose-900/30 bg-rose-950/5 p-8 h-full">
                    <div className="flex justify-between items-baseline border-b border-rose-900/20 pb-4">
                        <h2 className="text-ui-label text-rose-500 uppercase tracking-widest">Total Annual Cost</h2>
                        <div className="text-ui-data text-rose-500">{efficiency.totalDragBps.toFixed(1)} <span className="ui-caption text-rose-900/60 ml-1">bps</span></div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-ui-data font-black text-rose-400">-{fmtUSD(totalLoss)} <span className="ui-caption text-rose-900/40 ml-2">per year</span></div>
                        <div className="text-ui-caption text-rose-900/60 uppercase tracking-widest">Aggregate Erosion</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 pt-12 border-t border-zinc-900/50">
                {/* 1. FEE OPTIMIZATION */}
                <div className="space-y-8">
                    <div className="ui-label text-zinc-500 uppercase tracking-[0.2em] border-b border-zinc-900 pb-4 ml-1">Fee Optimization</div>
                    {feeRisks.length > 0 ? (
                        <div className="space-y-4">
                            {feeRisks.map((risk, i) => (
                                <div key={i} className="flex flex-col bg-zinc-900/20 rounded-sm border border-zinc-900/50 overflow-hidden hover:border-zinc-700 transition-colors">
                                    <div className="p-6 space-y-4">
                                        <div className="space-y-1">
                                            <div className="text-ui-label font-black text-white uppercase tracking-tighter">Swap {risk.currentTicker} → {risk.betterTicker}</div>
                                            <div className="ui-caption text-zinc-500 uppercase tracking-widest">Eliminate {risk.savingsBps.toFixed(1)} bps from position</div>
                                        </div>
                                    </div>
                                    <Link href="/#execution-queue" className="w-full text-center py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] border-t border-emerald-500/10 transition-all">
                                        View Trade →
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="ui-caption text-zinc-700 italic ml-1">No optimization opportunities detected.</div>
                    )}
                </div>

                {/* 2. PLACEMENT CORRECTIONS */}
                <div className="space-y-8">
                    <div className="ui-label text-zinc-500 uppercase tracking-[0.2em] border-b border-zinc-900 pb-4 ml-1">Placement Corrections</div>
                    {taxIssues.length > 0 ? (
                        <div className="space-y-4">
                            {taxIssues.slice(0, 3).map((issue, i) => (
                                <div key={i} className="flex flex-col bg-zinc-900/20 rounded-sm border border-zinc-900/50 overflow-hidden hover:border-zinc-700 transition-colors">
                                    <div className="p-6 space-y-4">
                                        <div className="space-y-1">
                                            <div className="text-ui-label font-black text-zinc-200 uppercase tracking-tighter">{issue.ticker} in {issue.currentAccountName}</div>
                                            <div className="ui-caption text-zinc-600 uppercase tracking-widest">Preferred location: {issue.preferredAccountType}</div>
                                        </div>
                                    </div>
                                    <Link href="/#execution-queue" className="w-full text-center py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] border-t border-emerald-500/10 transition-all">
                                        View Trade →
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="ui-caption text-zinc-700 italic ml-1">No placement corrections required.</div>
                    )}
                </div>
            </div>
        </section>
    );
}
