
import React from 'react';
import { generateAuditReport } from '@/lib/logic/auditEngine';
import PerformanceWaterfallClientV2 from './PerformanceWaterfallClientV2';

export default async function PerformanceBridgeV2() {
    const report = await generateAuditReport();
    const { horizons, efficiency, tv } = report;

    // Use the 1Y ACTUAL horizon as the P&L baseline
    const planHorizon = horizons.find(h => h.horizon === '1Y ACTUAL') || horizons[0];
    
    const feeDrag = (efficiency?.expenseDragBps || 0) / 10000;
    const taxDrag = (efficiency?.locationDragBps || 0) / 10000;
    
    const feeDollars = feeDrag * tv;
    const taxDollars = taxDrag * tv;

    // DRIFT DRAG: Total Gap minus the structural parts (Fee/Tax)
    const totalGap = planHorizon.targetReturn - planHorizon.portfolioReturn;
    const driftDrag = totalGap - feeDrag - taxDrag;
    const driftDollars = driftDrag * tv;

    return (
        <section className="space-y-12">
            <div className="flex justify-between items-end border-b border-zinc-900/50 pb-8">
                <h2 className="text-ui-header text-white">Performance Bridge</h2>
            </div>
            
            <PerformanceWaterfallClientV2
                marketReturn={planHorizon.marketReturn}
                targetReturn={planHorizon.targetReturn}
                feeDrag={feeDrag}
                feeDollars={feeDollars}
                taxDrag={taxDrag}
                taxDollars={taxDollars}
                driftDrag={driftDrag}
                driftDollars={driftDollars}
                actualReturn={planHorizon.portfolioReturn}
                totalValue={tv}
            />
        </section>
    );
}
