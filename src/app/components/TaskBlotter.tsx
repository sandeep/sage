'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Directive as LogicDirective, PersistedDirective } from '@/lib/logic/rebalancer';

interface Directive extends PersistedDirective {}

const TYPE_COLORS: Record<string, string> = {
    BUY: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    SELL: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    OPTIMIZATION: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    PLACEMENT: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    REBALANCE: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
};

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

    // IA: Group by Strategic Move (link_key / asset_class)
    const strategicMoves: Record<string, Directive[]> = {};
    list.forEach(d => {
        const key = d.asset_class || d.link_key || 'Global Optimization';
        if (!strategicMoves[key]) strategicMoves[key] = [];
        strategicMoves[key].push(d);
    });

    return (
        <div className="space-y-12 p-8 bg-zinc-950">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-6">
                <div>
                    <h3 className="ui-label text-zinc-500 uppercase tracking-[0.2em]">Execution Queue</h3>
                    <div className="ui-caption text-zinc-700 mt-1 italic">Structured instructions grouped by strategic goal</div>
                </div>
                <button 
                    onClick={() => setShowHistory(!showHistory)} 
                    className="text-ui-caption hover:text-emerald-500 transition-colors bg-zinc-900 px-4 py-1.5 border border-zinc-800 rounded-sm cursor-pointer uppercase font-black"
                >
                    {showHistory ? 'View Pending' : 'View History'}
                </button>
            </div>

            {Object.keys(strategicMoves).length === 0 ? (
                <div className="py-20 text-center border border-zinc-900 border-dashed rounded-sm">
                    <div className="text-ui-caption text-zinc-700 italic">Strategic equilibrium maintained. No pending directives.</div>
                </div>
            ) : (
                <div className="space-y-16">
                    {Object.entries(strategicMoves).map(([goal, items]) => {
                        const totalAmount = items.reduce((acc, d) => acc + (d.amount || 0), 0);
                        
                        return (
                            <div key={goal} className="space-y-6">
                                {/* Row Header: The Strategic Change */}
                                <div className="flex justify-between items-end border-b border-zinc-900/50 pb-4">
                                    <div>
                                        <div className="ui-label text-emerald-500 uppercase tracking-widest">{goal}</div>
                                        <div className="ui-caption text-zinc-600 mt-1">Realigning allocation state across {new Set(items.map(i => i.account_id)).size} accounts</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="ui-value font-black text-white">${totalAmount.toLocaleString()}</div>
                                        <div className="ui-caption text-zinc-700 uppercase tracking-tighter">Total Notional</div>
                                    </div>
                                </div>

                                {/* Detail Table: The Accounts & Trades */}
                                <div className="grid grid-cols-1 gap-4">
                                    {items.map(d => {
                                        const isTranche = d.tranche_total > 1;
                                        const isLiquidation = d.description.includes('(Move to Cash)');
                                        let tradeLabel = d.source_ticker && d.target_ticker ? `SELL ${d.source_ticker} | BUY ${d.target_ticker}` : d.description;

                                        return (
                                            <div key={d.id} className={`group bg-zinc-900/10 border border-zinc-900 rounded-sm hover:border-zinc-800 transition-all ${processingId === d.id ? 'opacity-30' : ''}`}>
                                                <div className="p-5 flex items-center justify-between gap-8">
                                                    {/* Account Context */}
                                                    <div className="w-[200px] shrink-0">
                                                        <div className="ui-label text-zinc-300 truncate">{d.account_nickname || 'Global'}</div>
                                                        <div className="text-[9px] text-zinc-700 uppercase font-black tracking-widest">{(d.account_provider || 'System').toUpperCase()}</div>
                                                    </div>

                                                    {/* Trade Instructions */}
                                                    <div className="flex-1 flex items-center gap-4">
                                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm border uppercase tracking-tighter whitespace-nowrap ${TYPE_COLORS[d.type] || 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'}`}>
                                                            {d.type}
                                                        </span>
                                                        <div className="flex-1">
                                                            <div className="text-ui-body font-black text-zinc-100 flex items-center gap-2">
                                                                {tradeLabel}
                                                                {isTranche && <span className="text-[10px] text-zinc-700 font-normal">Stage {d.tranche_index} of {d.tranche_total}</span>}
                                                            </div>
                                                            {isTranche && (
                                                                <div className="mt-1.5 h-0.5 w-32 bg-zinc-900 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full bg-emerald-500/30 transition-all" 
                                                                        style={{ width: `${(d.tranche_index / d.tranche_total * 100)}%` }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Amount */}
                                                    <div className="w-[100px] text-right shrink-0">
                                                        <div className="ui-body font-black text-zinc-300">${(d.amount || 0).toLocaleString()}</div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {!showHistory && (
                                                            d.status === 'PENDING' ? (
                                                                <>
                                                                    <button onClick={() => updateStatus(d.id, 'ACCEPTED')} className="text-[10px] bg-emerald-600 text-white px-4 py-1.5 rounded-sm hover:bg-emerald-500 transition-all font-black uppercase tracking-widest cursor-pointer">
                                                                        Accept
                                                                    </button>
                                                                    <button onClick={() => updateStatus(d.id, 'SNOOZED')} className="text-[10px] text-zinc-600 hover:text-zinc-200 px-3 py-1.5 transition-all cursor-pointer font-black uppercase">
                                                                        Snooze
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button onClick={() => updateStatus(d.id, 'EXECUTED')} className="text-[10px] text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/10 px-6 py-1.5 transition-all bg-emerald-950/5 cursor-pointer font-black uppercase tracking-widest">
                                                                    Mark Executed
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
