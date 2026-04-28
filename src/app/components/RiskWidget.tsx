'use client';

import React from 'react';
import { usePrivacy } from './PrivacyContext';

interface ConcentrationRisk {
    ticker: string;
    name: string;
    percentage: number;
    value: number;
    rationale: string;
    isFundLookthrough: boolean;
}

interface RiskWidgetProps {
    risks: ConcentrationRisk[];
}

const fmtPct = (val: number) => (val * 100).toFixed(1) + '%';
const fmtUSD = (val: number) => {
    if (val >= 1_000_000) return '$' + (val / 1_000_000).toFixed(2) + 'M';
    if (val >= 1_000) return '$' + (val / 1_000).toFixed(1) + 'k';
    return '$' + Math.round(val);
};

export default function RiskWidget({ risks }: RiskWidgetProps) {
    const { privacy } = usePrivacy();

    return (
        <div className="space-y-12">
            <div className="grid grid-cols-1 gap-8">
                {/* CONCENTRATION AUDIT */}
                <div className="bg-zinc-950/50 border border-zinc-900 rounded-sm shadow-2xl p-8 space-y-8">
                    <div className="flex justify-between items-baseline border-b border-zinc-900 pb-4">
                        <span className="text-[10px] text-zinc-700 font-mono">THRESHOLD: 5.0%</span>
                    </div>

                    {risks.length === 0 ? (
                        <div className="py-12 text-center text-ui-caption text-zinc-700 italic">No significant concentration risks detected.</div>
                    ) : (
                        <div className="space-y-4">
                            {risks.map((risk, i) => (
                                <div key={i} className="flex justify-between items-center bg-zinc-900/20 p-5 rounded-sm border border-zinc-900/50 group hover:border-zinc-700 transition-colors">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-ui-data text-white font-black">{risk.ticker}</span>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest truncate max-w-[200px]">{risk.name}</span>
                                        </div>
                                        <div className="text-[10px] text-zinc-600 font-mono italic">{risk.rationale}</div>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <div className="text-ui-data text-rose-500 font-black">{fmtPct(risk.percentage)}</div>
                                        <div className="text-ui-caption text-zinc-700">{privacy ? '•••' : fmtUSD(risk.value)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
