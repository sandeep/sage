'use client';
import React, { useState, useEffect } from 'react';
import { StrategicSettings } from '@/lib/db/settings';

export default function AssumptionsEditor() {
    const [settings, setSettings] = useState<StrategicSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/admin/settings')
            .then(res => res.json())
            .then(data => {
                setSettings(data);
                setLoading(false);
            });
    }, []);

    const save = async (newSettings: StrategicSettings) => {
        setSaving(true);
        await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSettings)
        });
        setSaving(false);
    };

    if (loading || !settings) return <div className="animate-pulse h-32 bg-zinc-900/20 rounded-sm" />;

    const update = (key: keyof StrategicSettings, val: string) => {
        const num = parseFloat(val) / 100;
        if (isNaN(num)) return;
        const next = { ...settings, [key]: num };
        setSettings(next);
        save(next);
    };

    return (
        <div className="bg-zinc-950 border border-zinc-900 rounded-sm p-8 space-y-8 font-mono shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-6">
                <div className="space-y-1">
                    <div className="text-sm font-black uppercase tracking-widest text-zinc-100">Strategic Assumptions</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold">Global Calculation Parameters</div>
                </div>
                {saving && <span className="text-[10px] font-black text-emerald-500 animate-pulse uppercase tracking-widest">Saving...</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="space-y-3">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ordinary Tax Rate</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            step="0.1"
                            value={(settings.ordinary_tax_rate * 100).toFixed(1)}
                            onChange={(e) => update('ordinary_tax_rate', e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-sm py-3 px-4 text-white font-black text-xl focus:outline-none focus:border-emerald-500/50 transition-colors"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">%</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 leading-relaxed italic">Applied to REITs, SCV, and Bonds in Taxable accounts.</p>
                </div>

                <div className="space-y-3">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Dividend Tax Rate</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            step="0.1"
                            value={(settings.dividend_tax_rate * 100).toFixed(1)}
                            onChange={(e) => update('dividend_tax_rate', e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-sm py-3 px-4 text-white font-black text-xl focus:outline-none focus:border-emerald-500/50 transition-colors"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">%</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 leading-relaxed italic">Applied to Qualified Stock Dividends in Taxable accounts.</p>
                </div>

                <div className="space-y-3">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Risk-Free Rate</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            step="0.1"
                            value={(settings.risk_free_rate * 100).toFixed(1)}
                            onChange={(e) => update('risk_free_rate', e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-sm py-3 px-4 text-white font-black text-xl focus:outline-none focus:border-emerald-500/50 transition-colors"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">%</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 leading-relaxed italic">Used as the anchor for Sharpe and M2 Delta calculations.</p>
                </div>
            </div>
        </div>
    );
}
