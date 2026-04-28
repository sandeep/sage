// src/app/components/AssetXRay.tsx
'use client';

import React from 'react';

interface CanonicalExposure {
    name: string;
    tickers: string[];
    totalValue: number;
    percentage: number;
}

export default function AssetXRay({ concentrations }: { concentrations: CanonicalExposure[] }) {
    return (
        <div className="bg-black border border-zinc-800 p-6 rounded-sm font-mono shadow-2xl">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400 mb-8 border-b border-zinc-800 pb-4">
                Allocation DNA
            </h2>
            <div className="space-y-8">
                {concentrations.map((c) => (
                    <div key={c.name} className="group">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-black text-zinc-200 group-hover:text-emerald-400 transition-colors uppercase tracking-tighter">
                                {c.name}
                            </span>
                            <span className={`text-[11px] font-black ${c.percentage > 0.1 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                {(c.percentage * 100).toFixed(1)}%
                            </span>
                        </div>
                        
                        <div className="w-full bg-zinc-900 h-0.5 mb-3 overflow-hidden">
                            <div 
                                className="bg-emerald-500 h-full transition-all duration-700 ease-out" 
                                style={{ width: `${c.percentage * 100}%` }} 
                            />
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {c.tickers.map(t => (
                                <span key={t} className="text-[8px] font-black bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded-sm uppercase border border-zinc-800 group-hover:border-zinc-700 group-hover:text-zinc-200 transition-all">
                                    {t}
                                </span>
                            ))}
                        </div>
                        
                        <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mt-3 flex justify-between">
                            <span>Exposure</span>
                            <span className="text-zinc-200">${c.totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
