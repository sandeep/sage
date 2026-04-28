'use client';
import React from 'react';

interface WaterfallStep {
    label: string;
    val: number;
    dollars?: number;
    type: 'start' | 'strategy' | 'drag' | 'gap' | 'end';
    color: 'white' | 'accent' | 'risk';
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
    totalValue: number;
}

export default function PerformanceWaterfallClientV2({
    marketReturn, targetReturn, feeDrag, feeDollars, taxDrag, taxDollars, driftDrag, driftDollars, actualReturn, totalValue
}: Props) {

    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
    const fmtBps = (v: number) => `${(Math.abs(v) * 10000).toFixed(1)} bps`;
    
    const dollar = (n: number | null) => {
        if (n == null) return '—';
        return `$${Math.round(Math.abs(n)).toLocaleString()}`;
    };

    const totalGapBps = (feeDrag + taxDrag + driftDrag) * 10000;
    const totalGapDollars = feeDollars + taxDollars + driftDollars;

    const items: WaterfallStep[] = [
        { label: 'Market Standard', val: marketReturn, type: 'start', color: 'white' },
        { label: 'Strategy Potential', val: targetReturn, dollars: targetReturn * totalValue, type: 'strategy', color: 'accent' },
        { label: 'Excess Fund Fees', val: feeDrag, dollars: feeDollars, type: 'drag', color: 'risk' },
        { label: 'Wrong Tax Placement', val: taxDrag, dollars: taxDollars, type: 'drag', color: 'risk' },
        { label: 'Wrong Asset Mix', val: driftDrag, dollars: driftDollars, type: 'drag', color: 'risk' },
        { label: 'Total Performance Gap', val: (feeDrag + taxDrag + driftDrag), dollars: totalGapDollars, type: 'gap', color: 'risk' },
        { label: 'Realized Return', val: actualReturn, dollars: actualReturn * totalValue, type: 'end', color: 'accent' },
    ];

    return (
        <div className="space-y-16">
            <div className="flex items-start w-full gap-4">
                {items.map((item, idx) => {
                    const isDrag = item.type === 'drag';
                    const isGap = item.type === 'gap';
                    const isEnd = item.type === 'end' || item.type === 'strategy';
                    
                    return (
                        <div key={idx} className="flex-1 flex flex-col items-center">
                            <div className="ui-label text-center h-16 flex flex-col justify-center mb-6 px-4">
                                <span className={`block mb-1 text-[10px] leading-tight ${
                                    item.color === 'accent' ? 'text-accent' : 
                                    item.color === 'risk' ? 'text-risk' : 'text-white'
                                }`}>{item.label}</span>
                            </div>
                            <div className={`w-full py-10 flex flex-col items-center justify-center border rounded-sm transition-all duration-300 ${
                                item.type === 'start' ? 'bg-zinc-900/20 border-zinc-900' :
                                item.type === 'strategy' ? 'bg-accent/10 border-accent/30' :
                                item.type === 'drag' ? 'bg-risk/5 border-risk/10' :
                                item.type === 'gap' ? 'bg-risk/10 border-risk/40 scale-105' :
                                'bg-accent/10 border-accent/40 shadow-2xl scale-110'
                            }`}>
                                <div className={`ui-metric ${isEnd ? 'text-accent' : 'text-truth'}`}>
                                    {fmtPct(item.val)}
                                </div>
                                
                                {(isDrag || isGap) && (
                                    <div className="ui-caption text-meta font-black opacity-60 mt-1">
                                        -{fmtBps(item.val)}
                                    </div>
                                )}

                                {item.dollars != null && item.dollars !== 0 && (
                                    <div className={`ui-caption font-bold mt-2 ${isEnd ? 'text-accent/60' : 'text-risk/80'}`}>
                                        {item.type === 'drag' || item.type === 'gap' ? '-' : ''}{dollar(item.dollars)}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
