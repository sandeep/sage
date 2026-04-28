import PerformanceGridV2 from './PerformanceGridV2';
import PerformanceBridgeV2 from './PerformanceBridgeV2';
import EfficiencyMapV2 from './EfficiencyMapV2';
import ResilienceAuditV2 from './ResilienceAuditV2';
import StrategicEvolutionV2 from './StrategicEvolutionV2';
import StructuralCostCenter from './StructuralCostCenter';
import RiskWidget from '../components/RiskWidget';
import { generateAuditReport } from '@/lib/logic/auditEngine';

export const dynamic = 'force-dynamic';

export default async function PassiveCore() {
    const report = await generateAuditReport();

    return (
        <main className="min-h-screen bg-black text-white font-mono relative">
            <div className="page-container ui-page-spacing">
                
                <div className="flex justify-between items-end border-b border-zinc-900 pb-8">
                    <div>
                        <h1 className="text-ui-hero">PASSIVE <span className="text-emerald-500">CORE</span></h1>
                        <p className="text-ui-label !text-zinc-500 mt-2 uppercase tracking-[0.3em]">Strategy & Realized Performance Dashboard</p>
                    </div>
                </div>

                {/* 1. Performance Overview */}
                <div className="space-y-12 pb-16 border-b border-zinc-900/30">
                    <PerformanceGridV2 />
                    <PerformanceBridgeV2 />
                </div>
                
                {/* 2. Cost and Risks */}
                <div className="space-y-32">
                    <StructuralCostCenter />
                    
                    <section className="space-y-12">
                        <div className="ui-section-header">
                            <h2>Concentration Risk</h2>
                            <span>Exposure Skew & Entity Analysis</span>
                        </div>
                        <RiskWidget 
                            risks={report.concentrationRisks ?? []} 
                        />
                    </section>
                </div>

                {/* 3. Resilience and Stress Tests */}
                <div className="pt-16 border-t border-zinc-900/30">
                    <ResilienceAuditV2 />
                </div>

                {/* 4. Deep Visual Analysis */}
                <div className="space-y-32 pt-16 border-t border-zinc-900/30">
                    <EfficiencyMapV2 />
                </div>

                {/* 5. Strategy Trail */}
                <div className="pt-16 border-t border-zinc-900/30">
                    <StrategicEvolutionV2 />
                </div>

                {/* Footer Meta */}
                <div className="pt-12 border-t border-zinc-900 flex justify-between items-center text-ui-caption text-zinc-700 uppercase font-black tracking-[0.2em]">
                    
                    <div>Sage Passive v2.0</div>
                </div>
            </div>
        </main>
    );
}
