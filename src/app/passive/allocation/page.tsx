// src/app/admin/allocation/page.tsx
import AllocationEditor from '../../components/AllocationEditor';
import AssumptionsEditor from '../../components/AssumptionsEditor';

export const dynamic = 'force-dynamic';

export default function AllocationPage() {
    return (
        <main className="min-h-screen bg-black text-white font-mono">
            <div className="page-container ui-page-spacing">
                <div className="flex justify-between items-end border-b border-zinc-900 pb-8">
                    <div>
                        <h1 className="text-ui-hero">TARGET <span className="text-emerald-500">STRATEGY</span></h1>
                        <p className="text-ui-label !text-zinc-500 mt-2 uppercase tracking-[0.3em]">Asset Allocation & Rebalance Model</p>
                    </div>
                </div>

                <AssumptionsEditor />
                
                <section>
                    <div className="ui-section-header">
                        <h2>Target Allocation Schema</h2>
                        <span>Weights must sum to 100.0%</span>
                    </div>
                    <AllocationEditor />
                </section>
            </div>
        </main>
    );
}
