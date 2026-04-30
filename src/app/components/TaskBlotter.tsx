'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Directive as LogicDirective } from '@/lib/logic/rebalancer';

interface Directive extends LogicDirective {
    id: number;
    status: 'PENDING' | 'ACCEPTED' | 'SNOOZED' | 'EXECUTED';
}

const TYPE_COLORS: Record<string, string> = {
    BUY: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    SELL: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    OPTIMIZATION: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    PLACEMENT: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    REBALANCE: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
};

function parseAccount(description: string): string {
    const inMatch = description.match(/ in (.+)$/);
    if (inMatch) return inMatch[1];
    
    const toMatch = description.match(/ to (.+)$/);
    if (toMatch) return toMatch[1];

    return 'Global / Multi-Account';
}

function getReasoningSubtitle(key: string, reasoning: string): string | null {
    const afterColon = reasoning.split(':')[1]?.trim();
    const text = afterColon || reasoning;
    const stripped = text.replace(/^(Excess in |Gap in |\$[\d.]+k Gap)/i, '').trim();
    if (stripped.toLowerCase() === key.toLowerCase()) return null;
    return text;
}

export default function TaskBlotter({ directives }: { directives: Directive[] }) {
    const router = useRouter();
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [groupBy, setGroupBy] = useState<'category' | 'account'>('account');

    const updateStatus = async (id: number, status: string) => {
        setProcessingId(id);
        await fetch('/api/directives', {
            method: 'POST',
            body: JSON.stringify({ id, status }),
            headers: { 'Content-Type': 'application/json' }
        });
        setProcessingId(null);
        router.refresh();
    };

    const pending = directives.filter(d => d.status === 'PENDING' || d.status === 'ACCEPTED');
    const history = directives.filter(d => d.status === 'EXECUTED' || d.status === 'SNOOZED');
    const list = showHistory ? history : pending;

    const allGroups: Record<string, Directive[]> = {};
    list.forEach(d => {
        const key = groupBy === 'account' ? parseAccount(d.description) : (d.link_key || 'Global');
        if (!allGroups[key]) allGroups[key] = [];
        allGroups[key].push(d);
    });

    const visibleGroups: Record<string, Directive[]> = {};
    if (showHistory) {
        Object.assign(visibleGroups, allGroups);
    } else {
        Object.entries(allGroups).forEach(([key, groupDirectives]) => {
            const trades: Record<string, Directive[]> = {};
            groupDirectives.forEach(d => {
                const tradeId = `${d.type}-${d.link_key}`;
                if (!trades[tradeId]) trades[tradeId] = [];
                trades[tradeId].push(d);
            });

            const nextMoves: Directive[] = [];
            Object.values(trades).forEach(t => {
                const sorted = t.sort((a, b) => a.tranche_index - b.tranche_index);
                const next = sorted.find(d => d.status === 'PENDING' || d.status === 'ACCEPTED');
                if (next) nextMoves.push(next);
            });

            if (nextMoves.length > 0) visibleGroups[key] = nextMoves;
        });
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end items-center pb-2">
                <div className="flex items-center gap-2">
                    <button onClick={() => setGroupBy(g => g === 'category' ? 'account' : 'category')} className="text-ui-caption hover:text-emerald-500 transition-colors bg-zinc-900 px-3 py-1 border border-zinc-800 rounded-sm cursor-pointer">
                        {groupBy === 'category' ? 'View by Account' : 'View by Category'}
                    </button>
                    <button onClick={() => setShowHistory(!showHistory)} className="text-ui-caption hover:text-emerald-500 transition-colors bg-zinc-900 px-3 py-1 border border-zinc-800 rounded-sm cursor-pointer">
                        {showHistory ? 'View Pending' : 'View History'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {Object.keys(visibleGroups).length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-zinc-950/50 border border-zinc-900 rounded-sm border-dashed">
                        <div className="text-ui-caption text-zinc-700 italic">No actionable directives identified. Portfolio is in strategic equilibrium.</div>
                    </div>
                ) : (
                    Object.entries(visibleGroups).map(([key, groupDirectives]) => (
                        <div key={key} className="bg-zinc-950 border border-zinc-900 rounded-sm overflow-hidden flex flex-col shadow-xl">
                            <div className="px-6 py-4 border-b border-zinc-900 bg-zinc-900/20">
                                <div className="text-ui-label text-emerald-500 truncate">{key}</div>
                                {(() => {
                                    const subtitle = getReasoningSubtitle(key, groupDirectives[0].reasoning);
                                    return subtitle ? (
                                        <div className="text-ui-caption opacity-40 italic mt-1 line-clamp-1">{subtitle}</div>
                                    ) : null;
                                })()}
                            </div>

                            <div className="p-6 space-y-6 flex-1">
                                {groupDirectives.map(d => {
                                    const isLiquidation = d.description.includes('(Move to Cash)');
                                    const label = d.description.split(' in ')[0].split(' to ')[0];
                                    const isTranche = d.tranche_total > 1;
                                    
                                    return (
                                        <div key={d.id} className={`space-y-4 ${processingId === d.id ? 'opacity-30' : ''}`}>
                                            <div className="flex items-start gap-2.5">
                                                <span className={`mt-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-sm border uppercase tracking-tighter whitespace-nowrap ${TYPE_COLORS[d.type] || 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'}`}>
                                                    {d.type}
                                                </span>
                                                <div className="flex-1">
                                                    <p className={`text-ui-data !text-xs leading-tight font-black ${isLiquidation ? 'text-rose-400' : 'text-zinc-100'}`}>
                                                        {label}
                                                        {isLiquidation && <span className="ml-1 text-rose-500/50 italic font-medium">(Move to Cash)</span>}
                                                        {isTranche && (
                                                            <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-zinc-900 text-zinc-500 rounded-full border border-zinc-800 whitespace-nowrap align-middle">
                                                                PART {d.tranche_index}/{d.tranche_total}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            {!showHistory && (
                                                <div className="flex gap-2">
                                                    {d.status === 'PENDING' ? (
                                                        <>
                                                            <button onClick={() => updateStatus(d.id, 'ACCEPTED')} className="text-ui-label bg-emerald-600 text-white px-4 py-1.5 rounded-sm hover:bg-emerald-500 transition-all shadow-lg cursor-pointer">
                                                                Accept {isTranche ? `Part ${d.tranche_index}` : ''}
                                                            </button>
                                                            <button onClick={() => updateStatus(d.id, 'SNOOZED')} className="text-ui-label !text-zinc-500 hover:!text-zinc-200 px-3 py-1.5 transition-all cursor-pointer">
                                                                Snooze
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => updateStatus(d.id, 'EXECUTED')} className="w-full text-ui-label !text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/10 py-2 transition-all bg-emerald-950/5 cursor-pointer">
                                                            Mark Part {d.tranche_index} Executed
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
