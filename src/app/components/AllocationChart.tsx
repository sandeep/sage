// src/app/components/AllocationChart.tsx
'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
    data: {
        label: string;
        target: number;
        actual: number;
    }[];
}

export default function AllocationChart({ data }: Props) {
    const chartData = data.map(d => ({
        name: d.label,
        Target: d.target * 100,
        Actual: d.actual * 100
    }));

    return (
        <div className="h-[300px] w-full font-mono">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="var(--zinc-meta)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                    />
                    <YAxis 
                        stroke="var(--zinc-meta)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--zinc-faint)', borderRadius: '4px', fontSize: '10px' }}
                        itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend iconType="rect" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                    <Bar dataKey="Target" fill="var(--zinc-faint)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Actual" fill="var(--accent)" radius={[2, 2, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
