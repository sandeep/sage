
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

    return (
        <section className="space-y-12">
            <div className="ui-section-header">
                <h2>Efficient Frontier</h2>
                <span>Risk/Reward Positioning</span>
            </div>
            <EfficiencyMapClientV2 
                coordinates={coordinates} 
                snapshotTrail={snapshotTrail} 
                frontierPoints={frontierPoints}
                globalFrontierPoints={globalFrontierPoints}
            />
        </section>
    );
}
