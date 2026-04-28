// src/app/api/performance/comparison/route.ts
import { NextRequest } from 'next/server';
import {
    flattenLeafWeights,
    simulateAllocationNAV,
    simulateSimbaAllocation,
    ETF_PROXY_MAP,
} from '@/lib/logic/allocationSimulator';
import { calculateHierarchicalMetrics } from '@/lib/logic/xray';
import {
    computeMaxDrawdown,
    navFromAnnualReturns,
} from '@/lib/logic/performanceMetrics';
import targetTree from '@/lib/data/target_allocation.json';
import {
    simbaData,
    PortfolioMetrics,
    recentStartDate,
    buildNavSeries,
    fetchPriceHistory,
    buildActualPortfolioNAV,
    navToAnnualReturns,
    metricsFromNAV,
    metricsFromSimba,
    CRISIS_PERIODS,
    computeCrisisDrawdown,
} from '@/lib/logic/comparisonEngine';

// ── ROUTE HANDLER ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const tab         = (searchParams.get('tab') ?? 'recent') as 'recent' | 'longrun';
    const windowParam = searchParams.get('window') ?? '3y';
    const draftB64    = searchParams.get('draft');

    // Parse optional draft weights
    let draftWeights: Record<string, number> | null = null;
    if (draftB64) {
        try {
            draftWeights = JSON.parse(Buffer.from(draftB64, 'base64url').toString('utf-8'));
        } catch (e: any) {
            console.warn('comparison API: malformed draft base64 payload —', e?.message);
        }
    }

    const targetWeights = flattenLeafWeights(targetTree as Record<string, any>);

    // ── RECENT TAB (ETF proxy daily simulation) ────────────────────────────
    if (tab === 'recent') {
        const startDate = recentStartDate();
        const endDate   = new Date().toISOString().split('T')[0];

        const allTickers = [...new Set([...Object.values(ETF_PROXY_MAP), 'VTI'])];
        const priceHistory = fetchPriceHistory(allTickers, startDate, endDate);

        const vtiDates = Object.keys(priceHistory['VTI'] ?? {}).sort();
        if (vtiDates.length < 60) {
            return Response.json({ error: `VTI price history insufficient for ${windowParam} window (need ≥60 trading days)` }, { status: 400 });
        }
        const vtiPrices = vtiDates.map(d => priceHistory['VTI'][d]);
        const vtiLogReturns: number[] = [];
        for (let i = 1; i < vtiPrices.length; i++) {
            if (vtiPrices[i - 1] > 0 && vtiPrices[i] > 0) {
                vtiLogReturns.push(Math.log(vtiPrices[i] / vtiPrices[i - 1]));
            } else {
                vtiLogReturns.push(0);
            }
        }
        const vtiAnnualReturns = navToAnnualReturns(vtiDates, vtiPrices);

        const targetSim = simulateAllocationNAV(targetWeights, priceHistory, startDate, endDate);
        const targetMetrics = targetSim
            ? metricsFromNAV(targetSim.dates, targetSim.nav, targetSim.dailyLogReturns, vtiLogReturns)
            : null;

        let proposedSim: ReturnType<typeof simulateAllocationNAV> = null;
        let proposedMetrics: PortfolioMetrics | null = null;
        if (draftWeights) {
            proposedSim = simulateAllocationNAV(draftWeights, priceHistory, startDate, endDate);
            if (proposedSim) {
                proposedMetrics = metricsFromNAV(proposedSim.dates, proposedSim.nav, proposedSim.dailyLogReturns, vtiLogReturns);
            }
        }

        const actualNAV = buildActualPortfolioNAV(startDate, endDate);
        let actualMetrics: PortfolioMetrics | null = null;
        if (actualNAV && actualNAV.nav.length >= 60) {
            const actualLogReturns: number[] = [];
            for (let i = 1; i < actualNAV.nav.length; i++) {
                if (actualNAV.nav[i - 1] > 0 && actualNAV.nav[i] > 0) {
                    actualLogReturns.push(Math.log(actualNAV.nav[i] / actualNAV.nav[i - 1]));
                } else {
                    actualLogReturns.push(0);
                }
            }
            actualMetrics = metricsFromNAV(actualNAV.dates, actualNAV.nav, actualLogReturns, vtiLogReturns);
        }

        const navSeries = buildNavSeries(vtiDates, vtiPrices, targetSim, actualNAV, proposedSim);

        return Response.json({
            actual:   actualMetrics,
            target:   targetMetrics,
            proposed: proposedMetrics,
            vti: {
                annualReturns:    vtiAnnualReturns,
                annualizedReturn: vtiPrices.length >= 2 ? (vtiPrices[vtiPrices.length - 1] / vtiPrices[0]) - 1 : null,
                maxDrawdown:      computeMaxDrawdown(vtiPrices.map((p) => p / vtiPrices[0])),
            },
            navSeries,
            excluded:        targetSim?.excluded ?? [],
            excludedWeight:  targetSim?.excludedWeight ?? 0,
            tab:    'recent',
            dataNote: targetSim && targetSim.excluded.length > 0
                ? `Excludes ${targetSim.excluded.length} sector fund(s) (${(targetSim.excludedWeight * 100).toFixed(1)}% of allocation) — weights redistributed.`
                : null,
        });
    }

    // ── LONG-RUN TAB (Simba annual data) ──────────────────────────────────
    const metrics = calculateHierarchicalMetrics();
    const currentWeights: Record<string, number> = {};
    metrics?.filter(m => m.level === 2).forEach(m => {
        if (m.actualPortfolio > 0) currentWeights[m.label] = m.actualPortfolio;
    });

    const targetSimba = simulateSimbaAllocation(targetWeights, simbaData);
    const actualSimba = simulateSimbaAllocation(currentWeights, simbaData);
    
    const canonicalYears = targetSimba ? targetSimba.years : [];
    if (canonicalYears.length === 0) {
        return Response.json({ error: "No historical data available for this allocation." }, { status: 400 });
    }

    const vtiEntry = simbaData['VTI'];
    const vtiReturnsArr = canonicalYears.map(y => vtiEntry.returns[String(y)] ?? 0);

    const targetMetrics = targetSimba
        ? metricsFromSimba(targetSimba.annualReturns, vtiReturnsArr, canonicalYears)
        : null;

    const actualMetrics = actualSimba
        ? metricsFromSimba(actualSimba.annualReturns, vtiReturnsArr, canonicalYears)
        : null;

    let proposedSimba: ReturnType<typeof simulateSimbaAllocation> = null;
    let proposedMetrics: PortfolioMetrics | null = null;
    if (draftWeights) {
        proposedSimba = simulateSimbaAllocation(draftWeights, simbaData);
        if (proposedSimba) {
            proposedMetrics = metricsFromSimba(proposedSimba.annualReturns, vtiReturnsArr, canonicalYears);
        }
    }

    const vtiAnnualReturnsRecord: Record<string, number> = {};
    canonicalYears.forEach((y, i) => { vtiAnnualReturnsRecord[String(y)] = vtiReturnsArr[i]; });

    const crisisData = CRISIS_PERIODS.map(c => ({
        name: c.name,
        years: c.years,
        vti:      computeCrisisDrawdown(vtiAnnualReturnsRecord, c.years, true),
        target:   targetMetrics   ? computeCrisisDrawdown(targetMetrics.annualReturns,   c.years) : null,
        actual:   actualMetrics   ? computeCrisisDrawdown(actualMetrics.annualReturns,   c.years) : null,
        proposed: proposedMetrics ? computeCrisisDrawdown(proposedMetrics.annualReturns, c.years) : null,
    }));

    const vtiNav = navFromAnnualReturns(vtiReturnsArr);
    const targetNavArr = targetSimba ? navFromAnnualReturns(targetSimba.annualReturns) : null;
    const actualNavArr = actualSimba ? navFromAnnualReturns(actualSimba.annualReturns) : null;
    const proposedNavArr = proposedSimba ? navFromAnnualReturns(proposedSimba.annualReturns) : null;

    const navSeries = canonicalYears.map((year, i) => ({
        t: String(year),
        vti: vtiNav[i + 1] * 100,
        target: targetNavArr ? targetNavArr[i + 1] * 100 : null,
        actual: actualNavArr ? actualNavArr[i + 1] * 100 : null,
        proposed: proposedNavArr ? proposedNavArr[i + 1] * 100 : null,
    }));

    return Response.json({
        actual:   actualMetrics,
        target:   targetMetrics,
        proposed: proposedMetrics,
        vti: {
            annualReturns:    vtiAnnualReturnsRecord,
            annualizedReturn: vtiReturnsArr.length > 0 ? vtiNav[vtiNav.length - 1] ** (1 / vtiReturnsArr.length) - 1 : null,
            maxDrawdown:      computeMaxDrawdown(vtiNav),
        },
        navSeries,
        excluded:       targetSimba?.excluded ?? [],
        excludedWeight: targetSimba?.excludedWeight ?? 0,
        crisisData,
        tab:       'longrun',
        window:    null,
        dataNote:  targetSimba && targetSimba.excluded.length > 0
            ? `Excludes ${targetSimba.excluded.length} categories with no Simba data (${(targetSimba.excludedWeight * 100).toFixed(1)}% of allocation) — weights redistributed.`
            : null,
    });
}
