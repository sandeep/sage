// src/app/passive/portfolio/page.tsx
import TaskBlotter from '../../components/TaskBlotter';
import MetricTable from '../../components/MetricTable';
import ForensicSankey from '../../components/ForensicSankey';
import DashboardSection from '../../components/Dashboard/DashboardSection';
import { getDashboardData } from '../../../lib/logic/dashboardService';

export const dynamic = 'force-dynamic';

export default async function CorePortfolio() {
  const {
    hierarchicalMetrics,
    allDirectives,
    nodes,
    links,
    unpricedCount,
    unmappedCount
  } = await getDashboardData();

  return (
    <main className="min-h-screen bg-black text-white font-mono">
      <div className="page-container ui-page-spacing">
        
        <div className="flex justify-between items-end border-b border-zinc-900 pb-8">
          <div>
            <h1 className="text-ui-hero">CORE <span className="text-emerald-500">PORTFOLIO</span></h1>
            <p className="text-ui-label !text-zinc-500 mt-2 uppercase tracking-[0.3em]">Allocation Tree & Account Mapping</p>
          </div>
        </div>

        {(unpricedCount > 0 || unmappedCount > 0) && (
            <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-amber-950/30 border border-amber-900/50 rounded-sm text-ui-caption">
                <span className="text-amber-500">⚠ Data Gaps Detected</span>
                {unpricedCount > 0 && (
                    <span className="text-amber-700">{unpricedCount} position{unpricedCount > 1 ? 's' : ''} missing pricing</span>
                )}
                {unmappedCount > 0 && (
                    <span className="text-amber-700">{unmappedCount} position{unmappedCount > 1 ? 's' : ''} unmapped</span>
                )}
                <a href="/api/refresh" className="ml-auto text-zinc-500 hover:text-emerald-500 transition-colors uppercase font-black">Force Refresh →</a>
            </div>
        )}

        {/* 1. ALLOCATION TREE (Hierarchy Table) */}
        <section>
            <div className="ui-section-header">
                <h2>Allocation Tree</h2>
                <span>Hierarchical Weighting</span>
            </div>
            <div className="border border-zinc-900 rounded-sm bg-zinc-950/50 shadow-2xl">
                <MetricTable metrics={hierarchicalMetrics} />
            </div>
        </section>

        {/* 2. ACCOUNT AND ASSET MAPPING */}
        <section>
            <div className="ui-section-header">
                <h2>Structural Topology</h2>
                <span>Account and Asset Mapping</span>
            </div>
            <div className="bg-zinc-950/50 border border-zinc-900 rounded-sm shadow-2xl overflow-hidden p-6">
                <ForensicSankey nodes={nodes} links={links} />
            </div>
        </section>

        {/* 3. REBALANCE DIRECTIVES */}
        <section>
            <div className="ui-section-header">
                <h2>Rebalance Directives</h2>
                <span>Architectural Realignments</span>
            </div>
            <div id="execution-queue" className="bg-zinc-950/50 border border-zinc-900 rounded-sm shadow-2xl overflow-hidden">
                <TaskBlotter directives={allDirectives} />
            </div>
        </section>

      </div>
    </main>
  );
}
