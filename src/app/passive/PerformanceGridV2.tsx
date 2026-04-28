
import React from 'react';
import { generateAuditReport } from '@/lib/logic/auditEngine';
import PerformanceGridClientV2 from './PerformanceGridClientV2';

export default async function PerformanceGridV2() {
    const report = await generateAuditReport();
    const data = report.horizons;
    const tv = report.tv;

    return (
        <PerformanceGridClientV2 data={data} totalValue={tv} />
    );
}
