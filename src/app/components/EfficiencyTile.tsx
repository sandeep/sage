'use client';
import React from 'react';
import { DragMetric } from '@/lib/logic/efficiency';

function scoreFromDrag(locationDragBps: number, expenseDragBps: number): number {
    const penalty = Math.min(locationDragBps + expenseDragBps, 200);
    return Math.max(0, Math.round(100 - penalty / 2));
}

export default function EfficiencyTile({ efficiency }: { efficiency: DragMetric }) {
    const score = scoreFromDrag(efficiency.locationDragBps, efficiency.expenseDragBps);
    const scoreColor = score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-rose-500';

    return (
        <div className="card space-y-8 shadow-2xl min-h-[260px]">
            <div className="flex justify-between items-baseline border-b border-zinc-900 pb-6">
                <h2 className="text-ui-label text-zinc-500">Efficiency Score</h2>
                <div className={`text-ui-data ${scoreColor}`}>{score}</div>
            </div>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-ui-caption opacity-60">Tax Leakage</span>
                    <span className={`text-ui-data !text-sm ${efficiency.locationDragBps > 20 ? 'text-rose-500' : 'text-zinc-400'}`}>
                        -{efficiency.locationDragBps.toFixed(0)} BPS
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-ui-caption opacity-60">Expense Drag</span>
                    <span className={`text-ui-data !text-sm ${efficiency.expenseDragBps > 10 ? 'text-amber-500' : 'text-zinc-400'}`}>
                        -{efficiency.expenseDragBps.toFixed(0)} BPS
                    </span>
                </div>
                <div className="flex justify-between items-center border-t border-zinc-900 pt-6">
                    <span className="text-ui-label text-zinc-600">Total Drag</span>
                    <span className="text-ui-data !text-base text-zinc-300">
                        -{efficiency.totalDragBps.toFixed(0)} BPS/yr
                    </span>
                </div>
            </div>
        </div>
    );
}
