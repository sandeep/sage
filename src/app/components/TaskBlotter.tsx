'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Directive as LogicDirective, PersistedDirective } from '@/lib/logic/rebalancer';
import { MetricRow } from '@/lib/logic/xray';

interface Directive extends PersistedDirective {}

interface TradeCell {
    account_id: string;
    directives: Directive[];
}

interface StrategicMoveRow {
    goal: string;
    headline: string;
    assetClass?: string;
    totalAmount: number;
    cells: Record<string, TradeCell>; // Keyed by account_id
    status: 'SYNCHRONIZED' | 'IN_PROGRESS' | 'ACTIONABLE';
}

const TYPE_COLORS: Record<string, string> = {
    BUY: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    SELL: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    OPTIMIZATION: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    PLACEMENT: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    REBALANCE: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
};

function getNarrativeHeadline(d: Directive) {
    if (d.type === 'REBALANCE') return `${d.source_asset_class || 'Cash'} → ${d.target_asset_class || 'System'}`;
    if (d.type === 'OPTIMIZATION') return `Fee Optimization: ${d.source_ticker || d.link_key}`;
    if (d.type === 'PLACEMENT') return `Tax Placement: ${d.source_ticker || d.link_key}`;
    if (d.type === 'SELL') return `Trim ${d.source_asset_class || 'Asset'} → Cash`;
    if (d.type === 'BUY') return `Accumulate ${d.target_asset_class || d.asset_class || 'Asset'}`;
    return d.asset_class || d.link_key || 'Global Optimization';
}

export default function TaskBlotter({ directives, metrics = [] }: { directives: Directive[], metrics?: MetricRow[] }) {
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
    const activeDirectives = showHistory ? history : pending;

    // 1. Identify all unique accounts present in the current view and gather metadata
    const accountMap: Record<string, { id: string, nickname: string, provider: string }> = {};
    activeDirectives.forEach(d => {
        const id = d.account_id || 'GLOBAL';
        if (!accountMap[id]) {
            accountMap[id] = {
                id,
                nickname: d.account_nickname || 'Global',
                provider: d.account_provider || 'System'
            };
        }
    });
    const uniqueAccountIds = Object.keys(accountMap);
    
    // 2. Pivot into StrategicMoveRow matrix
    const goalGroups: Record<string, Directive[]> = {};
    activeDirectives.forEach(d => {
        // Create a more semantic and safe grouping key
        const source = d.source_asset_class || (d.type === 'REBALANCE' || d.type === 'SELL' ? 'Asset' : 'System');
        const target = d.target_asset_class || d.asset_class || d.link_key;
        const key = `${d.type}_${source}_to_${target}`;
        
        if (!goalGroups[key]) goalGroups[key] = [];
        goalGroups[key].push(d);
    });

    const strategicMoves: StrategicMoveRow[] = Object.entries(goalGroups).map(([goal, items]) => {
        const cells: Record<string, TradeCell> = {};
        
        items.forEach(d => {
            const accountId = d.account_id || 'GLOBAL';
            if (!cells[accountId]) {
                cells[accountId] = { account_id: accountId, directives: [] };
            }
            cells[accountId].directives.push(d);
        });

        const totalAmount = items.reduce((acc, d) => acc + (d.amount || 0), 0);
        const hasPending = items.some(d => d.status === 'PENDING');
        const hasAccepted = items.some(d => d.status === 'ACCEPTED');

        const firstDirective = items[0];
        const assetClass = firstDirective.target_asset_class || firstDirective.source_asset_class || firstDirective.asset_class;

        return {
            goal,
            headline: getNarrativeHeadline(items[0]),
            assetClass,
            totalAmount,
            cells,
            status: hasPending ? 'ACTIONABLE' : (hasAccepted ? 'IN_PROGRESS' : 'SYNCHRONIZED')
        };
    });

    // 3. Merge with Hierarchical Metrics to show asset classes in equilibrium
    const activeAssetClasses = new Set<string>();
    activeDirectives.forEach(d => {
        if (d.asset_class) activeAssetClasses.add(d.asset_class);
        if (d.target_asset_class) activeAssetClasses.add(d.target_asset_class);
        if (d.source_asset_class) activeAssetClasses.add(d.source_asset_class);
    });
    
    const equilibriumRows: StrategicMoveRow[] = (metrics || [])
        .filter(m => m.level === 2 && !activeAssetClasses.has(m.label))
        .map(m => ({
            goal: m.label,
            headline: m.label,
            assetClass: m.label,
            totalAmount: 0,
            cells: {},
            status: 'SYNCHRONIZED' as const
        }));

    const allRows = [...strategicMoves, ...equilibriumRows].sort((a, b) => {
        const priority = { ACTIONABLE: 0, IN_PROGRESS: 1, SYNCHRONIZED: 2 };
        if (priority[a.status] !== priority[b.status]) {
            return priority[a.status] - priority[b.status];
        }
        return a.headline.localeCompare(b.headline);
    });

    const totalValue = metrics.find(m => m.level === -1)?.actualValue || 0;

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

            {allRows.length === 0 ? (
                <div className="py-20 text-center border border-zinc-900 border-dashed rounded-sm">
                    <div className="text-ui-caption text-zinc-700 italic">Strategic equilibrium maintained. No pending directives.</div>
                </div>
            ) : (
                <div className="max-h-[75vh] overflow-auto -mx-8 px-8 border border-zinc-900 rounded-sm">
                    <table className="w-full border-separate border-spacing-0">
                        <thead className="sticky top-0 z-30">
                            <tr className="bg-zinc-950">
                                <th className="sticky top-0 left-0 z-40 bg-zinc-950 px-4 py-1 border-b border-zinc-900 min-w-[320px] text-left shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)]">
                                    <div className="ui-label text-zinc-500 uppercase tracking-widest text-[10px]">Strategic Move</div>
                                </th>
                                {uniqueAccountIds.map(accId => (
                                    <th key={accId} className="px-4 py-1 border-b border-zinc-900 min-w-[300px] max-w-[300px] text-left bg-zinc-950">
                                        <div className="flex items-center gap-2">
                                            <div className="ui-label text-zinc-300  ">{accountMap[accId].nickname}</div>
                                            <div className="text-ui-caption text-zinc-700 uppercase font-black tracking-widest">{accountMap[accId].provider.toUpperCase()}</div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {allRows.map((row) => {
                                const metric = metrics.find(m => m.label === row.assetClass);
                                const actual = metric?.actualValue || 0;
                                const target = (metric?.expectedPortfolio || 0) * totalValue;
                                const shift = target - actual;
                                const shiftColor = Math.abs(shift) < 1 ? 'text-zinc-500' : (shift >= 0 ? 'text-emerald-500' : 'text-rose-500');
                                const shiftPrefix = shift >= 0 ? '+' : '';

                                return (
                                    <tr key={row.goal} className={`group transition-colors ${row.status === 'SYNCHRONIZED' ? 'opacity-50' : ''}`}>
                                        {/* Sticky Row Header */}
                                        <td className="sticky left-0 z-20 bg-zinc-950 px-4 py-1 border-b border-zinc-900 align-middle shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)] group-hover:bg-zinc-900/20 cursor-pointer hover:bg-zinc-900">
                                            <div className="flex items-center gap-3">
                                                <div className={`text-ui-caption font-bold px-1 py-0.5 rounded-sm border uppercase tracking-tighter ${
                                                    row.status === 'ACTIONABLE' ? 'text-amber-500 border-amber-500/20 bg-amber-500/5' : 
                                                    row.status === 'IN_PROGRESS' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 
                                                    'text-zinc-500 border-zinc-500/20 bg-zinc-500/5'
                                                }`}>
                                                    {row.status === 'ACTIONABLE' ? 'ACT' : row.status === 'IN_PROGRESS' ? 'PRG' : 'SYN'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className={`ui-label text-[13px] ${row.status === 'SYNCHRONIZED' ? 'text-zinc-600' : 'text-emerald-500'}`}>{row.headline}</div>
                                                    <div className="flex items-center gap-2 text-[10px] tabular-nums">
                                                        <span className="text-zinc-500">${Math.round(actual).toLocaleString()}</span>
                                                        <span className="text-zinc-700">→</span>
                                                        <span className="text-white">${Math.round(target).toLocaleString()}</span>
                                                        <span className={`font-black ${shiftColor}`}>({shiftPrefix}${Math.round(shift).toLocaleString()})</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Minimal Progress Line */}
                                            <div className="h-0.5 w-full bg-zinc-900 absolute bottom-0 left-0 overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all duration-1000 ${shift >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                    style={{ 
                                                        left: `${Math.min(100, (Math.min(actual, target) / Math.max(actual, target, 1)) * 100)}%`,
                                                        width: `${Math.min(100, (Math.abs(shift) / Math.max(actual, target, 1)) * 100)}%`
                                                    }}
                                                />
                                            </div>
                                        </td>

                                        {/* Account Columns */}
                                        {uniqueAccountIds.map(accId => {
                                            const cell = row.cells[accId];
                                            return (
                                                <td key={accId} className="px-4 py-1 border-b border-zinc-900 align-middle group-hover:bg-zinc-900/10 transition-colors min-w-[300px] max-w-[300px]">
                                                    {cell ? (
                                                        <div className="flex flex-col gap-1">
                                                            {cell.directives.map(d => (
                                                                <div key={d.id} className={`flex items-center justify-between gap-2 text-[11px] ${processingId === d.id ? 'opacity-30' : ''}`}>
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span className={`text-ui-caption font-black px-1 py-0 border rounded-[2px] uppercase shrink-0 ${TYPE_COLORS[d.type] || 'text-zinc-500 border-zinc-500/20 bg-zinc-500/5'}`}>
                                                                            {d.type === 'REBALANCE' ? 'SWAP' : d.type}
                                                                        </span>                                                                        <span className="font-black text-white  ">
                                                                            {d.source_ticker && d.target_ticker ? `${d.source_ticker}→${d.target_ticker}` : d.source_ticker || d.target_ticker || d.description}
                                                                        </span>
                                                                        <span className="font-black text-zinc-500 tabular-nums shrink-0">
                                                                            ${(d.amount || 0).toLocaleString()}
                                                                        </span>
                                                                    </div>

                                                                    {!showHistory && (
                                                                        <div className="flex gap-1 shrink-0">
                                                                            {d.status === 'PENDING' ? (
                                                                                <button 
                                                                                    disabled={processingId !== null}
                                                                                    onClick={() => updateStatus(d.id, 'ACCEPTED')} 
                                                                                    className="px-2 py-0.5 text-[9px] bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-[2px] hover:bg-emerald-600/30 transition-all font-black uppercase cursor-pointer disabled:opacity-50"
                                                                                >
                                                                                    Accept
                                                                                </button>
                                                                            ) : (
                                                                                <button 
                                                                                    disabled={processingId !== null}
                                                                                    onClick={() => updateStatus(d.id, 'EXECUTED')} 
                                                                                    className="px-2 py-0.5 text-[9px] text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all bg-emerald-950/5 rounded-[2px] font-black uppercase cursor-pointer disabled:opacity-50"
                                                                                >
                                                                                    Execute
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="opacity-10 text-zinc-500 text-[10px] text-center">
                                                            —
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
