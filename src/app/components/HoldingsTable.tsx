// src/app/components/HoldingsTable.tsx
'use client';
import React, { useState } from 'react';

interface TickerRow {
    ticker: string;
    total_quantity: number;
    total_market_value: number;
    account_count: number;
    value: number | null;
    impliedPrice: number | null;
}

interface AccountRow {
    ticker: string;
    account_id: string;
    display_name: string;
    provider: string;
    tax_character: string;
    quantity: number;
    market_value: number | null;
}

const TAX_COLORS: Record<string, string> = {
    ROTH: 'text-emerald-500 border-emerald-900',
    DEFERRED: 'text-blue-500 border-blue-900',
    TAXABLE: 'text-amber-500 border-amber-900',
};

export default function HoldingsTable({
    tickers,
    accountsByTicker,
}: {
    tickers: TickerRow[];
    accountsByTicker: Record<string, AccountRow[]>;
}) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const toggle = (ticker: string) =>
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(ticker) ? next.delete(ticker) : next.add(ticker);
            return next;
        });

    return (
        <div className="card overflow-hidden !p-0">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="label-meta font-black border-b border-zinc-900 bg-zinc-950">
                        <th className="px-8 py-4 w-8"></th>
                        <th className="px-4 py-4">Ticker</th>
                        <th className="px-4 py-4 text-right">Quantity</th>
                        <th className="px-4 py-4 text-right">Price</th>
                        <th className="px-4 py-4 text-right">Market Value</th>
                        <th className="px-4 py-4 text-right">Accounts</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                    {tickers.map(row => (
                        <React.Fragment key={row.ticker}>
                            <tr
                                onClick={() => row.account_count > 1 && toggle(row.ticker)}
                                className={`group transition-colors ${row.account_count > 1 ? 'cursor-pointer hover:bg-zinc-900/30' : ''}`}
                            >
                                <td className="px-8 py-4 text-zinc-700">
                                    {row.account_count > 1 && (
                                        <span className="text-xs">{expanded.has(row.ticker) ? '▼' : '▶'}</span>
                                    )}
                                </td>
                                <td className="px-4 py-4 font-black text-zinc-100 group-hover:text-emerald-500">{row.ticker}</td>
                                <td className="px-4 py-4 text-right text-zinc-400 font-bold">{row.total_quantity.toLocaleString()}</td>
                                <td className="px-4 py-4 text-right text-zinc-500 font-bold">
                                    {row.impliedPrice != null ? `$${row.impliedPrice.toFixed(2)}` : <span className="text-amber-700">—</span>}
                                </td>
                                <td className="px-4 py-4 text-right text-white font-black">
                                    {row.value != null
                                        ? `$${row.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                        : <span className="text-amber-700">—</span>
                                    }
                                </td>
                                <td className="px-4 py-4 text-right text-zinc-600 font-bold text-[11px]">{row.account_count}</td>
                            </tr>
                            {expanded.has(row.ticker) && accountsByTicker[row.ticker]?.map((acc, i) => (
                                <tr key={`${row.ticker}-${acc.account_id}-${i}`} className="bg-zinc-950/50 border-t border-zinc-900/50">
                                    <td></td>
                                    <td colSpan={1} className="px-8 py-3">
                                        <div className="text-[11px] font-black text-zinc-400">{acc.display_name}</div>
                                        <div className="text-xs text-zinc-600 uppercase tracking-tighter">{acc.provider}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-black uppercase tracking-widest border px-1.5 py-0.5 rounded-sm ${TAX_COLORS[acc.tax_character] || 'text-zinc-500 border-zinc-800'}`}>
                                            {acc.tax_character}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-zinc-500 text-[11px]">{acc.quantity.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-zinc-400 text-[11px] font-bold">
                                        {acc.market_value != null && acc.market_value > 0
                                            ? `$${acc.market_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                            : <span className="text-amber-700">—</span>
                                        }
                                    </td>
                                    <td></td>
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
