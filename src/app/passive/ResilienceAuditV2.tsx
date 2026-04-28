
import React from 'react';
import { getComparisonData } from '@/lib/logic/comparisonEngine';
import CrisisStressTableV2 from './CrisisStressTableV2';
import db from '@/lib/db/client';

export default async function ResilienceAuditV2() {
    const data = await getComparisonData('longrun');
    const totalValue = data.totalValue || 0;

    // Data Gap Detection: Find held tickers missing historical proxies
    const missingProxies = db.prepare(`
        SELECT DISTINCT ticker FROM holdings_ledger 
        WHERE ticker NOT IN (SELECT ticker FROM asset_registry WHERE proxy_weights IS NOT NULL AND proxy_weights != '')
        AND ticker NOT IN ('CASH', '**')
    `).all() as { ticker: string }[];

    const dollar = (pct: number | null) => {
        if (pct === null) return '—';
        const amount = Math.abs(pct * totalValue);
        return `$${Math.round(amount).toLocaleString()}`;
    };

    // Calculate Dynamic Risk Verdict for GFC
    const gfcData = data.crisisData?.find(d => d.name === 'GFC');
    const actualGfc = gfcData?.actual || 0;
    const targetGfc = gfcData?.target || 0;
    const additionalRisk = Math.max(0, (actualGfc - targetGfc) * totalValue);
    
    return (
        <section id="resilience-audit" className="space-y-12 text-left">
            <div className="ui-section-header">
                <h2>Crisis Simulation</h2>
                <span>Historical Stress Test</span>
            </div>

            <div className="space-y-8">

                {missingProxies.length > 0 && (
                    <div className="bg-rose-950/10 border border-rose-900/30 p-6 rounded-sm space-y-2">
                        <div className="ui-label text-rose-500 font-black tracking-widest uppercase flex items-center gap-2">
                            <span>⚠ Institutional Data Gap</span>
                            <span className="w-1 h-1 bg-rose-500/40 rounded-full" />
                            <span className="text-[10px] lowercase italic font-normal text-rose-500/60">Simulations will use market-wide fallbacks</span>
                        </div>
                        <p className="ui-caption text-zinc-500 leading-relaxed max-w-2xl">
                            Simba proxies are missing for: <span className="text-zinc-300 font-bold">{missingProxies.map(p => p.ticker).join(', ')}</span>. 
                            Historical stress tests for your actual portfolio are currently limited to global market approximations.
                        </p>
                    </div>
                )}
            </div>

            <div className="space-y-10">
                {data.crisisData && totalValue > 0 && (
                    <CrisisStressTableV2
                        crisisData={data.crisisData}
                        totalValue={totalValue}
                    />
                )}
            </div>
        </section>
    );
}
