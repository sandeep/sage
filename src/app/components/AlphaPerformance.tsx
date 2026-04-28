// src/app/components/AlphaPerformance.tsx
'use client';

import React from 'react';

interface Props {
    sharpe: number | null;
    sortino: number | null;
    realizedPnl: number;
    winningTrades: number;
    totalTrades: number;
}

export default function AlphaPerformance({ sharpe, sortino, realizedPnl, winningTrades, totalTrades }: Props) {
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return (
        <div className="card">
            <div className="flex justify-between items-center mb-8 border-b border-zinc-900 pb-4">
                <h2 className="label-section">Alpha Performance</h2>
                <span className="label-meta">Section 1256 Contracts</span>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="space-y-1">
                    <span className="label-meta">Sharpe Ratio</span>
                    <div className="text-2xl font-black text-zinc-200">{sharpe !== null ? sharpe.toFixed(2) : '—'}</div>
                </div>
                <div className="space-y-1 text-right">
                    <span className="label-meta">Sortino Ratio</span>
                    <div className="text-2xl font-black text-emerald-500">{sortino !== null ? sortino.toFixed(2) : '—'}</div>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-zinc-900">
                <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-600 uppercase">Realized P&L</span>
                    <span className={`font-black ${realizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        ${realizedPnl.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-600 uppercase">Win Rate</span>
                    <span className="text-zinc-200 font-black">{winRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-600 uppercase">Total Alpha Volume</span>
                    <span className="text-zinc-200 font-black">{totalTrades} Executions</span>
                </div>
            </div>
        </div>
    );
}
