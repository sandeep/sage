
import React from 'react';
import { TaxPlacementIssue } from '@/lib/logic/xray_risks';

const TIER_LABELS: Record<string, string> = {
    'very_inefficient': 'High Impact',
    'inefficient': 'Moderate Impact',
    'efficient': 'Optimal'
};

export default function TaxPlacementTableV2({ issues }: { issues: TaxPlacementIssue[] }) {
    if (!issues || issues.length === 0) {
        return (
            <div className="bg-zinc-950 border border-zinc-900 rounded-sm p-12 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-700">Tax Placement Matrix: Optimal</div>
                <p className="text-[9px] text-zinc-500 mt-2 uppercase tracking-widest italic">All detected assets are located in high-integrity account types.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-black border border-zinc-900/50 rounded-sm overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="ui-label border-b border-zinc-900/50 bg-card">
                            <th className="px-10 py-5">Instrument</th>
                            <th className="px-10 py-5">Account Type</th>
                            <th className="px-10 py-5">Preferred Location</th>
                            <th className="px-10 py-5 text-right">Market Value</th>
                            <th className="px-10 py-5 text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/50 ui-value">
                        {issues.map((issue, i) => (
                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                <td className="px-10 py-5">
                                    <div className="text-white font-bold uppercase">{issue.ticker}</div>
                                    <div className="ui-caption text-meta mt-0.5">{issue.allocationLabel}</div>
                                </td>
                                <td className="px-10 py-5">
                                    <span className="text-truth">{issue.currentAccountType}</span>
                                    <div className="ui-caption text-meta truncate max-w-[150px]">{issue.currentAccountName}</div>
                                </td>
                                <td className="px-10 py-5 text-truth font-bold">
                                    {issue.preferredAccountType}
                                </td>
                                <td className="px-10 py-5 text-right tabular-nums text-truth">
                                    ${issue.holdingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="px-10 py-5 text-right">
                                    <span className={`px-2 py-0.5 rounded-[2px] ui-caption font-black tracking-tighter ${
                                        issue.type === 'LEAKAGE' ? 'bg-risk/10 text-risk border border-risk/20' : 'bg-yield/10 text-yield border border-yield/20'
                                    }`}>
                                        {issue.type}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex gap-10 px-2">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">LEAKAGE: High-yield assets in Taxable accounts</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">OPTIMIZATION: Growth assets in Deferred vs Roth</span>
                </div>
            </div>
        </div>
    );
}
