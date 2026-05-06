
import React from 'react';
import { generateAuditReport } from '@/lib/logic/auditEngine';
import { getSnapshotTrail } from '@/lib/logic/snapshotBrowser';
import EfficiencyMapClientV2 from './EfficiencyMapClientV2';

export default async function EfficiencyMapV2() {
    const report = await generateAuditReport();
    const coordinates = report.coordinates;
    const frontierPoints = report.frontierPoints;
    const globalFrontierPoints = report.globalFrontierPoints;
    const snapshotTrail = getSnapshotTrail();

    // Calculate driftDrag1Y (Total Gap - Fee - Tax) for the Strategic Verdict
    const planHorizon = report.horizons.find(h => h.horizon === '1Y ACTUAL') || report.horizons[0];
    const feeDrag = (report.efficiency?.expenseDragBps || 0) / 10000;
    const taxDrag = (report.efficiency?.locationDragBps || 0) / 10000;
    const totalGap1Y = planHorizon.targetReturn - planHorizon.portfolioReturn;
    const driftDrag1Y = totalGap1Y - feeDrag - taxDrag;

    return (
        <section className="space-y-12">
            <div className="ui-section-header">
                <h2>Efficient Frontier (50-Year Average)</h2>
                <span>Risk/Reward Positioning</span>
            </div>
            <EfficiencyMapClientV2 
                coordinates={coordinates} 
                snapshotTrail={snapshotTrail} 
                frontierPoints={frontierPoints}
                globalFrontierPoints={globalFrontierPoints}
                driftDrag1Y={driftDrag1Y}
            />
        </section>
    );
}
