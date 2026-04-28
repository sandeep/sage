'use client';

import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

interface DataPoint {
    date: string;
    alphaNav: number;
    shadowNav: number;
}

interface Props {
    data: DataPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-zinc-900 border border-zinc-800 p-4 shadow-2xl font-mono text-[10px] space-y-2">
                <div className="font-black text-white uppercase border-b border-zinc-800 pb-1">{label}</div>
                <div className="space-y-1 pt-1">
                    {payload.map((entry: any, i: number) => (
                        <div key={i} className="flex justify-between gap-8">
                            <span style={{ color: entry.color }} className="font-bold">{entry.name}:</span>
                            <span style={{ color: entry.color }} className="font-black">${entry.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export default function AlphaNavChart({ data }: Props) {
    if (!data || data.length === 0) {
        return (
            <div className="w-full h-[400px] flex items-center justify-center border border-dashed border-zinc-800 rounded text-zinc-600 font-mono text-xs">
                No performance data available.
            </div>
        );
    }

    return (
        <div className="w-full h-full font-mono">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                    <XAxis 
                        dataKey="date" 
                        stroke="#3f3f46" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        interval={Math.floor(data.length / 8)}
                    />
                    <YAxis 
                        stroke="#3f3f46" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                        verticalAlign="top" 
                        align="right" 
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ 
                            fontSize: '10px', 
                            textTransform: 'uppercase', 
                            fontWeight: 'bold',
                            paddingBottom: '20px'
                        }}
                        formatter={(value: string) => <span className="text-zinc-400 mr-4">{value}</span>}
                    />
                    <Line 
                        name="Actual Portfolio"
                        type="monotone" 
                        dataKey="alphaNav" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        dot={false}
                        activeDot={{ r: 4, fill: '#10b981', stroke: '#000' }}
                    />
                    <Line 
                        name="Equivalent VTI"
                        type="monotone" 
                        dataKey="shadowNav" 
                        stroke="#52525b" 
                        strokeWidth={1.5} 
                        strokeDasharray="4 4"
                        dot={false}
                        activeDot={{ r: 4, fill: '#52525b', stroke: '#000' }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
