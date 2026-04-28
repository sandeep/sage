// src/app/admin/allocation/page.tsx
import AllocationEditor from '../../components/AllocationEditor';
import AssumptionsEditor from '../../components/AssumptionsEditor';

export const dynamic = 'force-dynamic';

export default function AllocationPage() {
    return (
        <main className="min-h-screen bg-black text-white font-mono p-16 space-y-16">
            <div className="max-w-[1400px] mx-auto space-y-16">
                <div className="border-b border-zinc-900 pb-12">
                    <h1 className="text-ui-hero">TARGET STRATEGY</h1>
                    <div className="text-ui-label !text-zinc-500 mt-2 uppercase tracking-[0.3em]">Asset Allocation & Rebalance Model</div>
                </div>

                <AssumptionsEditor />
                
                <div className="space-y-8">
                    <div className="flex justify-between items-baseline">
                        <h2 className="text-xl font-black uppercase tracking-widest text-zinc-400">Target Allocation Schema</h2>
                        <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest tracking-[0.2em]">Weights must sum to 100.0%</span>
                    </div>
                    <AllocationEditor />
                </div>
            </div>
        </main>
    );
}
