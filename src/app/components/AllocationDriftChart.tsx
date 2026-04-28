'use client';
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface HistoryPoint {
    id: number;
    date: string;
    label: string;
    expectedCagr: number;
    stockWeight: number;
}

export default function AllocationDriftChart({ history }: { history: HistoryPoint[] }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (history.length <= 1) return null;
    if (!mounted) {
        return <div className="w-full h-[300px] bg-zinc-900/5 animate-pulse rounded-sm" />;
    }
    return (
        <div className="card space-y-4">
            <div className="label-caption">Allocation Drift over Time</div>
            <p className="text-[11px] text-zinc-600">Target Expected CAGR and stock weight across saved versions.</p>
            <ResponsiveContainer width="100%" height={180}>
                <LineChart data={history} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="cagr" tickFormatter={v => `${(v * 100).toFixed(1)}%`} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={44} />
                    <YAxis yAxisId="stock" orientation="right" tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={{ background: '#09090b', border: '1px solid #27272a', fontSize: 11, fontFamily: 'monospace' }} labelStyle={{ color: '#a1a1aa' }} formatter={(val: any) => [`${(Number(val) * 100).toFixed(1)}%`]} />
                    <Legend formatter={name => name === 'expectedCagr' ? 'E[CAGR]' : 'Stock %'} wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', color: '#71717a' }} />
                    <Line yAxisId="cagr" type="monotone" dataKey="expectedCagr" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                    <Line yAxisId="stock" type="monotone" dataKey="stockWeight" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                </LineChart>
            </ResponsiveContainer>
            <div className="space-y-1 border-t border-zinc-900 pt-3">
                {history.map(h => (
                    <div key={h.id} className="flex gap-3 text-[11px] text-zinc-500">
                        <span className="text-zinc-700 tabular-nums w-24">{h.date}</span>
                        <span className="text-emerald-600 tabular-nums w-14">{(h.expectedCagr * 100).toFixed(1)}%</span>
                        <span className="text-indigo-400 tabular-nums w-12">{(h.stockWeight * 100).toFixed(0)}% eq</span>
                        <span className="text-zinc-600 truncate">{h.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
