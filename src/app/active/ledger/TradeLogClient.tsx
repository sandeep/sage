'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { TradeLogEntry } from '@/lib/logic/alpha/engine/metrics';
import FloatingTooltip from '../../components/FloatingTooltip';

interface TradeLogClientProps {
    initialFutures: TradeLogEntry[];
    initialOptions: TradeLogEntry[];
    initialEquities: TradeLogEntry[];
}

type Tab = 'Futures' | 'Options' | 'Equities';

export default function TradeLogClient({ initialFutures, initialOptions, initialEquities }: TradeLogClientProps) {
    const [activeTab, setActiveTab] = useState<Tab>('Futures');
    const [sortField, setSortField] = useState<keyof TradeLogEntry>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const data = useMemo(() => {
        let current = activeTab === 'Futures' ? initialFutures :
                      activeTab === 'Options' ? initialOptions :
                      initialEquities;

        return [...current].sort((a, b) => {
            const valA = a[sortField] ?? '';
            const valB = b[sortField] ?? '';
            if (valA === valB) return 0;
            const res = valA < valB ? -1 : 1;
            return sortDir === 'asc' ? res : -res;
        });
    }, [activeTab, initialFutures, initialOptions, initialEquities, sortField, sortDir]);

    // Group by Year for UI
    const groupedData = useMemo(() => {
        const groups: Record<string, TradeLogEntry[]> = {};
        data.forEach(item => {
            const year = item.date.substring(0, 4) || 'Unknown';
            if (!groups[year]) groups[year] = [];
            groups[year].push(item);
        });
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    }, [data]);

    const stats = useMemo(() => {
        if (data.length === 0) return null;
        const wins = data.filter(d => d.pnl > 0);
        const losses = data.filter(d => d.pnl < 0);
        const winRate = wins.length / data.length;
        const totalPnl = data.reduce((a, b) => a + b.pnl, 0);
        const grossGains = wins.reduce((a, b) => a + b.pnl, 0);
        const grossLosses = Math.abs(losses.reduce((a, b) => a + b.pnl, 0));
        const profitFactor = grossLosses > 0 ? grossGains / grossLosses : grossGains > 0 ? Infinity : 0;
        const expectedValue = totalPnl / data.length;

        return { winRate, profitFactor, expectedValue, totalPnl };
    }, [data]);

    const toggleRow = (id: string) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedRows(newSet);
    };

    const handleSort = (field: keyof TradeLogEntry) => {
        if (field === sortField) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
    const fmtUSD = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const isSettlementBasis = activeTab === 'Futures' && data.some(d => d.instrument === 'Futures Sweep');

    return (
        <div className="page-container ui-page-spacing">
            {/* Header */}
            <div className="flex justify-between items-end border-b border-zinc-900 pb-8">
                <div>
                    <h1 className="text-ui-hero">
                        TRADING <span className="text-emerald-500">LEDGER</span>
                    </h1>
                    <div className="flex items-center gap-4 mt-4">
                        <Link href="/alpha" className="text-ui-label hover:text-white transition-colors">← Dashboard</Link>
                        <div className="w-px h-3 bg-zinc-800"></div>
                        <span className="text-ui-label !text-zinc-600">
                            {isSettlementBasis ? 'Basis: Daily Settlement' : 'Basis: Transaction Ledger'}
                        </span>
                    </div>
                </div>
                <div className="flex bg-zinc-950 border border-zinc-900 p-1 rounded-sm">
                    {(['Futures', 'Options', 'Equities'] as Tab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeTab === tab ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Top Summary */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <SummaryTile 
                        label="Total Realized" 
                        value={fmtUSD(stats.totalPnl)} 
                        color={stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'} 
                    />
                    
                    <FloatingTooltip title="Win Rate" content="Percentage of trades that resulted in a positive P&L. Focuses on hit-rate integrity.">
                        <SummaryTile label="Win Rate" value={fmtPct(stats.winRate)} />
                    </FloatingTooltip>

                    <FloatingTooltip title="Profit Factor" content="Physical measure of Gross Wins divided by Gross Losses. A value > 2.0 indicates institutional grade expectancy.">
                        <SummaryTile label="Profit Factor" value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)} />
                    </FloatingTooltip>

                    <FloatingTooltip title="Expected Value" content="Average dollar outcome per trade. Physically projects the expected gain/loss if you were to repeat this strategy.">
                        <SummaryTile label="Expected Value" value={fmtUSD(stats.expectedValue)} sub={isSettlementBasis ? '/ day' : '/ trade'} />
                    </FloatingTooltip>
                </div>
            )}

            {/* Table */}
            <div className="bg-zinc-950/50 border border-zinc-900 rounded-sm shadow-2xl overflow-hidden min-h-[400px]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-900/50 border-b border-zinc-900">
                            <SortHeader label="Date" field="date" current={sortField} dir={sortDir} onSort={handleSort} />
                            <SortHeader label="Instrument" field="instrument" current={sortField} dir={sortDir} onSort={handleSort} />
                            {!isSettlementBasis && (
                                <SortHeader label="Side" field="direction" current={sortField} dir={sortDir} onSort={handleSort} />
                            )}
                            <SortHeader label="Entry" field="entry" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                            <SortHeader label="Exit" field="exit" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                            <SortHeader label="Hold" field="hold" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                            <SortHeader label="P&L" field="pnl" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                            <SortHeader label="%" field="pct" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/50">
                        {groupedData.map(([year, trades]) => (
                            <React.Fragment key={year}>
                                {/* Year Sticky Header */}
                                <tr className="bg-zinc-900/30">
                                    <td colSpan={8} className="px-6 py-2">
                                        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] flex items-center gap-3">
                                            <span>{year} Trading Session</span>
                                            <div className="h-px bg-emerald-500/10 flex-1"></div>
                                            <span className="text-zinc-600 italic normal-case font-normal">{trades.length} Actions</span>
                                        </div>
                                    </td>
                                </tr>
                                
                                {trades.map((trade, i) => {
                                    const rowId = `${trade.date}-${trade.instrument}`;
                                    const isExpanded = expandedRows.has(rowId);
                                    
                                    return (
                                        <React.Fragment key={i}>
                                            <tr 
                                                className={`transition-colors group ${isSettlementBasis ? 'cursor-pointer hover:bg-zinc-900/40' : 'hover:bg-zinc-900/20'}`}
                                                onClick={() => isSettlementBasis && toggleRow(rowId)}
                                            >
                                                <td className="px-6 py-3 text-xs text-zinc-400 font-bold whitespace-nowrap pl-10">
                                                    {isSettlementBasis && (
                                                        <span className="inline-block w-4 text-[8px] text-zinc-500">{isExpanded ? '▼' : '▶'}</span>
                                                    )}
                                                    {trade.date}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="text-xs font-black text-zinc-200">{trade.instrument}</div>
                                                    {trade.optionType && (
                                                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                                                            {trade.expiry} {trade.strike ? `$${trade.strike}` : ''} {trade.optionType}
                                                        </div>
                                                    )}
                                                </td>
                                                {!isSettlementBasis && (
                                                    <td className="px-6 py-3 text-[10px]">
                                                        <span className={`px-2 py-0.5 rounded-[2px] font-black tracking-tighter ${
                                                            trade.direction === 'LONG' ? 'bg-zinc-800 text-zinc-200' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                                        }`}>
                                                            {trade.direction}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="px-6 py-3 text-xs text-zinc-400 text-right tabular-nums">
                                                    {trade.entry > 0 ? trade.entry.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                                </td>
                                                <td className="px-6 py-3 text-xs text-zinc-400 text-right tabular-nums">
                                                    {trade.exit > 0 ? trade.exit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                                </td>
                                                <td className="px-6 py-3 text-xs text-zinc-500 text-right tabular-nums">{trade.hold > 0 ? `${trade.hold}d` : '—'}</td>
                                                <td className={`px-6 py-3 text-sm font-black text-right tabular-nums ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                                    {fmtUSD(trade.pnl)}
                                                </td>
                                                <td className={`px-6 py-3 text-xs font-black text-right tabular-nums ${trade.pct !== 0 ? (trade.pct >= 0 ? 'text-emerald-400/80' : 'text-rose-500/80') : 'text-zinc-800'}`}>
                                                    {trade.pct !== 0 ? fmtPct(trade.pct) : '—'}
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-zinc-950/80 border-l-2 border-emerald-500/30">
                                                    <td colSpan={8} className="px-12 py-6">
                                                        <div className="flex flex-col items-center justify-center space-y-2 py-8 border border-dashed border-zinc-900 rounded-sm">
                                                            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Execution Proof Pending</div>
                                                            <div className="text-[9px] text-zinc-600 uppercase">Import PDF Statement to reconcile individual fills</div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
                {data.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-700 space-y-2">
                        <div className="text-4xl">∅</div>
                        <div className="text-[10px] uppercase tracking-widest font-black">No trades found for this book</div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SortHeader({ label, field, current, dir, onSort, align = 'left' }: { 
    label: string, 
    field: keyof TradeLogEntry, 
    current: string, 
    dir: string, 
    onSort: (f: any) => void,
    align?: 'left' | 'right'
}) {
    return (
        <th 
            className={`px-6 py-4 text-ui-label cursor-pointer hover:text-white transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
            onClick={() => onSort(field)}
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
                {label}
                {current === field && (
                    <span className="text-emerald-500">{dir === 'asc' ? '↑' : '↓'}</span>
                )}
            </div>
        </th>
    );
}

function SummaryTile({ label, value, color = 'text-zinc-200', sub }: { label: string, value: string, color?: string, sub?: string }) {
    return (
        <div className="bg-zinc-950/50 border border-zinc-900 p-6 rounded-sm space-y-2 shadow-xl w-full h-full">
            <span className="text-ui-label tracking-[0.2em]">{label}</span>
            <div className={`text-ui-data ${color}`}>
                {value}
                {sub && <span className="text-ui-caption ml-1 font-bold">{sub}</span>}
            </div>
        </div>
    );
}
