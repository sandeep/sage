// src/app/components/MacroInsights.tsx
'use client';

import React, { useState, useEffect } from 'react';

interface MacroData {
    state: 'NORMAL' | 'FLAT' | 'INVERTED';
    spread: number;
}

export default function MacroInsights() {
    const [data, setData] = useState<MacroData | null>(null);

    useEffect(() => {
        fetch('/api/macro')
            .then(res => res.json())
            .then(setData);
    }, []);

    if (!data) return <div className="animate-pulse bg-zinc-950 h-24 rounded-sm border border-zinc-900" />;

    const getStatusColor = () => {
        if (data.state === 'INVERTED') return 'text-red-500';
        if (data.state === 'FLAT') return 'text-orange-500';
        return 'text-emerald-500';
    };

    return (
        <div className="card transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                    <h3 className="label-caption">Yield Curve Signal</h3>
                    <div className={`text-xs font-black uppercase tracking-tighter ${getStatusColor()}`}>
                        {data.state}
                    </div>
                </div>
                <span className="text-2xl font-black text-zinc-200 tracking-tighter leading-none">
                    {data.spread.toFixed(2)}%
                </span>
            </div>
            
            <div className="flex gap-1 h-1 bg-zinc-900 rounded-full overflow-hidden mb-4">
                <div className={`h-full ${data.state === 'INVERTED' ? 'w-full bg-red-500' : 'w-1/3 bg-transparent'}`} />
                <div className={`h-full ${data.state === 'FLAT' ? 'w-full bg-orange-500' : 'w-1/3 bg-transparent'}`} />
                <div className={`h-full ${data.state === 'NORMAL' ? 'w-full bg-emerald-500' : 'w-1/3 bg-transparent'}`} />
            </div>

            <p className="label-meta opacity-80 pt-2 border-t border-zinc-900/50">
                Current State: {data.state}
            </p>
        </div>
    );
}
