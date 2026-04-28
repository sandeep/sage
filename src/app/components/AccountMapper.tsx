// src/app/components/AccountMapper.tsx
'use client';

import React, { useState, useEffect } from 'react';

interface Account {
    id: string;
    provider: string;
    tax_character: string;
    account_type: string;
    purpose: string;
    allowed_tickers?: string;
    nickname?: string;
    total_value?: number;
}

const ACCOUNT_CONFIGS = [
    { label: 'Roth IRA / 401(k)', type: 'ROTH_IRA', character: 'ROTH' },
    { label: 'Traditional IRA / 401(k)', type: 'IRA', character: 'DEFERRED' },
    { label: 'Taxable Brokerage', type: 'BROKERAGE', character: 'TAXABLE' },
    { label: 'HSA (Triple Tax-Free)', type: 'HSA', character: 'ROTH' },
    { label: 'Banking / Cash', type: 'BANKING', character: 'TAXABLE' },
    { label: 'Other', type: 'OTHER', character: 'TAXABLE' },
];

export default function AccountMapper({ onBootstrap, onPurge }: { onBootstrap: () => void; onPurge: () => void }) {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/accounts')
            .then(res => res.json())
            .then(data => {
                setAccounts(data);
                setLoading(false);
            });
    }, []);

    const updateAccountConfig = async (id: string, configLabel: string) => {
        const config = ACCOUNT_CONFIGS.find(c => c.label === configLabel);
        if (!config) return;

        const updates = { 
            account_type: config.type, 
            tax_character: config.character 
        };

        await fetch('/api/accounts', {
            method: 'POST',
            body: JSON.stringify({ id, ...updates }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    };

    const updateAvailability = async (id: string, allowed_tickers: string) => {
        await fetch('/api/accounts', {
            method: 'POST',
            body: JSON.stringify({ id, allowed_tickers }),
            headers: { 'Content-Type': 'application/json' }
        });
        setAccounts(prev => prev.map(a => a.id === id ? { ...a, allowed_tickers } : a));
    };

    const updateNickname = async (id: string, nickname: string) => {
        await fetch('/api/accounts', {
            method: 'POST',
            body: JSON.stringify({ id, nickname }),
            headers: { 'Content-Type': 'application/json' }
        });
        setAccounts(prev => prev.map(a => a.id === id ? { ...a, nickname } : a));
    };

    if (loading) return <div className="label-caption text-center py-20">Loading Account Registry...</div>;

    const grandTotal = accounts.reduce((sum, acc) => sum + (acc.total_value || 0), 0);

    return (
        <div className="w-full bg-black selection:bg-emerald-500/30">
            <div className="bg-zinc-900/30 p-10 border-b border-zinc-900 flex justify-between items-center">
                <h2 className="text-ui-header !text-lg">Configuration</h2>
                <div className="flex items-center gap-10">
                    <div className="text-right space-y-1">
                        <span className="text-ui-label !text-zinc-500 block">Total Account Value</span>
                        <span className="text-ui-data text-emerald-500">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="text-ui-label border-b border-zinc-900 bg-zinc-950">
                        <th className="px-10 py-6">Account</th>
                        <th className="px-10 py-6 text-right">Value</th>
                        <th className="px-10 py-6">Nickname</th>
                        <th className="px-10 py-6">Type</th>
                        <th className="px-10 py-6">Allowed Tickers</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                    {accounts.map(acc => {
                        const currentConfig = ACCOUNT_CONFIGS.find(c => c.type === acc.account_type || (!acc.account_type && c.character === acc.tax_character));
                        if (!currentConfig) return null;

                        return (
                            <tr key={acc.id} className="group hover:bg-zinc-900/20 transition-colors">
                                <td className="px-10 py-8">
                                    <div className="text-ui-body font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">
                                        {acc.provider}
                                    </div>
                                    <div className="text-ui-caption text-zinc-600 mt-1">{acc.id}</div>
                                </td>
                                <td className="px-10 py-8 text-right text-ui-body tabular-nums text-zinc-400">
                                    {typeof acc.total_value === 'number' ? `$${acc.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '$0.00'}
                                </td>
                                <td className="px-10 py-8">
                                    <input
                                        type="text"
                                        defaultValue={acc.nickname || ''}
                                        onBlur={(e) => updateNickname(acc.id, e.target.value)}
                                        placeholder="Display Name"
                                        className="w-full bg-zinc-950 border border-zinc-900 text-ui-body px-4 py-2 focus:border-emerald-500/50 focus:outline-none transition-colors rounded-sm"
                                    />
                                </td>
                                <td className="px-10 py-8">
                                    <select 
                                        value={currentConfig.label}
                                        onChange={(e) => updateAccountConfig(acc.id, e.target.value)}
                                        className="bg-zinc-950 border border-zinc-900 text-ui-body rounded-sm px-4 py-2 w-full outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none"
                                    >
                                        {ACCOUNT_CONFIGS.map(c => (
                                            <option key={c.label} value={c.label}>{c.label}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-10 py-8">
                                    <input 
                                        type="text"
                                        placeholder="ALL"
                                        defaultValue={acc.allowed_tickers || 'ALL'}
                                        onBlur={(e) => updateAvailability(acc.id, e.target.value)}
                                        className="bg-zinc-950 border border-zinc-900 text-ui-body rounded-sm px-4 py-2 w-full outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-800 uppercase tracking-widest"
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
