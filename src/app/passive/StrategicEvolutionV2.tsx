
import React from 'react';
import db from '@/lib/db/client';
import AllocationDriftChart from '@/app/components/AllocationDriftChart';

function computeExpectedCagr(tree: Record<string, any>): number {
    let cagrSum = 0;
    function walk(node: any) {
        if (node.expected_return != null) cagrSum += node.weight * node.expected_return;
        if (node.categories) Object.values(node.categories).forEach(walk);
        if (node.subcategories) Object.values(node.subcategories).forEach(walk);
    }
    Object.values(tree).forEach(walk);
    return cagrSum;
}

function computeStockWeight(tree: Record<string, any>): number {
    return (tree['Stock']?.weight as number) ?? 0;
}

async function getStrategyHistory() {
    const rows = db.prepare(
        `SELECT id, created_at, label, snapshot FROM allocation_versions ORDER BY id ASC`
    ).all() as { id: number; created_at: string; label: string; snapshot: string }[];

    return rows.map(row => {
        try {
            const tree = JSON.parse(row.snapshot);
            return {
                id: row.id,
                date: row.created_at.slice(0, 10),
                label: row.label,
                expectedCagr: computeExpectedCagr(tree),
                stockWeight: computeStockWeight(tree),
            };
        } catch {
            return null;
        }
    }).filter((x): x is any => x !== null);
}

export default async function StrategicEvolutionV2() {
    const history = await getStrategyHistory();

    if (history.length <= 1) return null;

    return (
        <section className="space-y-12">
            <div className="ui-section-header">
                <h2>Strategic Drift</h2>
                <span>Allocation vs Targets Trail</span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-16">
                <div className="xl:col-span-2">
                    <AllocationDriftChart history={history} />
                </div>
                <div className="flex flex-col justify-center space-y-6">
                    <div className="ui-label text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-4">Audit Insight</div>
                    <p className="ui-caption leading-relaxed text-zinc-400">
                        This chart tracks the <span className="text-emerald-500">Expected CAGR</span> and <span className="text-indigo-400">Stock Exposure</span> 
                        across every saved version of your target strategy. 
                    </p>
                    <p className="ui-caption leading-relaxed text-zinc-500 italic">
                        Sudden spikes in either line indicate manual regime shifts in your investment philosophy.
                    </p>
                </div>
            </div>
        </section>
    );
}
