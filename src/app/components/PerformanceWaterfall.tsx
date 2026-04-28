'use client';
import React from 'react';
import { usePrivacy } from './PrivacyContext';

interface WaterfallStep {
    label: string;
    val: number;
    dollars?: number;
    type: 'start' | 'strategy' | 'drag' | 'end';
    color: 'white' | 'indigo' | 'rose' | 'emerald';
}

interface Props {
    marketReturn: number;
    targetReturn: number;
    feeDrag: number;
    feeDollars: number;
    taxDrag: number;
    taxDollars: number;
    driftDrag: number;
    driftDollars: number;
    actualReturn: number;
}

export default function PerformanceWaterfall({
    marketReturn, targetReturn, feeDrag, feeDollars, taxDrag, taxDollars, driftDrag, driftDollars, actualReturn
}: Props) {
    const { privacy } = usePrivacy();

    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
    const fmtBps = (v: number) => `${(v * 10000).toFixed(0)} bps`;
    
    const dollar = (n: number | null) => {
        if (n == null) return '—';
        return privacy
            ? <span className="opacity-20 italic font-medium tracking-tighter text-zinc-500">$ **,***</span>
            : <span>${Math.round(Math.abs(n)).toLocaleString()}</span>;
    };

    const items: WaterfallStep[] = [
        { label: 'Market Standard', val: marketReturn, type: 'start', color: 'white' },
        { label: 'Strategy Potential', val: targetReturn, type: 'strategy', color: 'indigo' },
        { label: 'Fee Drag', val: feeDrag, dollars: feeDollars, type: 'drag', color: 'rose' },
        { label: 'Tax Leakage', val: taxDrag, dollars: taxDollars, type: 'drag', color: 'rose' },
        { label: 'Strategic Drift', val: driftDrag, dollars: driftDollars, type: 'drag', color: 'rose' },
        { label: 'Your Realized Ride', val: actualReturn, type: 'end', color: 'emerald' },
    ];

    return (
        <div className="space-y-16">
            <div className="flex items-start w-full gap-2">
                {items.map((item, idx) => {
                    const isDrag = item.type === 'drag';
                    const isStrategy = item.type === 'strategy';
                    
                    return (
                        <React.Fragment key={idx}>
                            <div className="flex-1 flex flex-col items-center">
                                <div className={`ui-label text-center h-16 flex flex-col justify-center mb-6 ${
                                    item.color === 'emerald' ? 'text-emerald-500' : 
                                    item.color === 'rose' ? 'text-rose-400' : 
                                    item.color === 'indigo' ? 'text-indigo-400' : 'text-zinc-400'
                                }`}>
                                    <span className="block mb-1">{item.label}</span>
                                    {isDrag && <span className="ui-caption text-zinc-600 font-bold">-{fmtBps(item.val)}</span>}
                                </div>
                                <div className={`w-full py-10 flex flex-col items-center justify-center border rounded-sm transition-all duration-300 ${
                                    item.type === 'start' ? 'bg-white/5 border-zinc-700' :
                                    item.type === 'strategy' ? 'bg-indigo-500/10 border-indigo-500/30' :
                                    item.type === 'drag' ? 'bg-rose-500/5 border-rose-500/10 grayscale-[50%]' :
                                    'bg-emerald-500/10 border-emerald-500/40 shadow-2xl scale-105'
                                }`}>
                                    <div className={`ui-metric ${item.type === 'end' ? 'text-emerald-400' : ''}`}>
                                        {fmtPct(item.val)}
                                    </div>
                                    {item.dollars != null && (
                                        <div className="ui-caption font-bold text-rose-500/80 mt-2">
                                            -{dollar(item.dollars)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {idx < items.length - 1 && (
                                <div className={`pt-32 px-1 ${isStrategy ? 'opacity-60' : 'opacity-20'}`}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className={isStrategy ? 'text-indigo-500' : 'text-zinc-700'}>
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            <div className="ui-value text-zinc-400 leading-relaxed max-w-5xl pt-10 border-t border-zinc-900/50 italic">
                <span className="ui-label text-white not-italic mr-4">Forensic Verdict:</span>
                Your strategy captures a <span className="text-indigo-400 font-bold">{(targetReturn - marketReturn > 0 ? '+' : '') + ((targetReturn - marketReturn) * 100).toFixed(1)}%</span> premium over the market standard. 
                Execution drift and structural drag leaked <span className="text-rose-400 font-bold mx-1">{dollar(driftDollars + taxDollars + feeDollars)}</span> of that potential this year.
            </div>
        </div>
    );
}
