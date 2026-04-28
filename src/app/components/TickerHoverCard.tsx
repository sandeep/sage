'use client';
import React from 'react';
import { MetricContributor } from '../../lib/logic/xray';

const fmtUSD = (val: number) => {
    if (val >= 1_000_000) return '$' + (val / 1_000_000).toFixed(2) + 'M';
    if (val >= 1_000) return '$' + (val / 1_000).toFixed(1) + 'k';
    return '$' + val.toFixed(0);
};

export default function TickerHoverCard({
    contributor: c,
    x,
    y,
    locSummary,
}: {
    contributor: MetricContributor;
    x: number;
    y: number;
    locSummary: string;
}) {
    const CARD_HEIGHT = 240;
    const CARD_WIDTH = 320;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const top = Math.max(8, y + CARD_HEIGHT > vh ? vh - CARD_HEIGHT - 8 : y - 8);
    const left = Math.min(x + 16, vw - CARD_WIDTH - 8);

    return (
        <div
            className="fixed z-[100] w-80 bg-zinc-900 border border-zinc-700 shadow-2xl rounded-sm p-4 pointer-events-none font-mono text-left"
            style={{ top, left }}
        >
            <div className="flex justify-between items-start border-b border-zinc-800 pb-3 mb-3">
                <div>
                    <div className="text-[14px] font-black text-white">{c.ticker}</div>
                    <div className="text-xs text-zinc-400 tracking-widest uppercase mt-0.5">{c.name || 'Instrument'}</div>
                </div>
                <div className="text-right">
                    <div className="text-[14px] font-black text-emerald-400">{fmtUSD(c.value)}</div>
                    <div className="text-xs text-zinc-500 tracking-widest uppercase mt-0.5">Aggregate Holding</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3 bg-black/50 p-2 rounded-sm border border-zinc-800/50">
                <div>
                    <div className="text-xs text-zinc-400 uppercase tracking-widest">Price</div>
                    <div className="text-[11px] font-black text-zinc-200">{c.close ? '$' + c.close.toFixed(2) : '—'}</div>
                </div>
                <div>
                    <div className="text-xs text-zinc-400 uppercase tracking-widest">52W Low</div>
                    <div className="text-[11px] font-black text-zinc-300">{c.fiftyTwoWeekLow ? '$' + c.fiftyTwoWeekLow.toFixed(2) : '—'}</div>
                </div>
                <div>
                    <div className="text-xs text-zinc-400 uppercase tracking-widest">52W High</div>
                    <div className="text-[11px] font-black text-zinc-300">{c.fiftyTwoWeekHigh ? '$' + c.fiftyTwoWeekHigh.toFixed(2) : '—'}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4 bg-black/50 p-2 rounded-sm border border-zinc-800/50">
                <div>
                    <div className="text-xs text-zinc-400 uppercase tracking-widest">Yield</div>
                    <div className="text-[11px] font-black text-zinc-200">{c.yield ? (c.yield * 100).toFixed(2) + '%' : '—'}</div>
                </div>
                <div>
                    <div className="text-xs text-zinc-400 uppercase tracking-widest">Exp Ratio</div>
                    <div className="text-[11px] font-black text-zinc-200">{c.er ? (c.er * 100).toFixed(2) + '%' : '—'}</div>
                </div>
            </div>

            <div className="space-y-2">
                <div className="text-xs text-zinc-400 uppercase tracking-widest border-b border-zinc-800/50 pb-1">Location</div>
                <div className="text-[11px] text-zinc-200 leading-relaxed font-bold">{locSummary}</div>
            </div>
        </div>
    );
}
