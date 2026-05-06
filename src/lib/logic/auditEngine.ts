
import db from '../db/client';
import { calculatePortfolioPerformance } from './portfolioEngine';
import { calculateHistoricalProxyReturns, SimbaResult, LABEL_TO_SIMBA, TICKER_TO_SIMBA } from './simbaEngine';
import { calculateHierarchicalMetrics } from './xray';
import { getExpenseRisks, getTaxPlacementIssues, getConcentrationRisks } from './xray_risks';
import { calculatePortfolioEfficiency } from './efficiency';
import { getAllocationTree } from '../db/allocation';
import { flattenLeafWeights } from './allocationSimulator';
import { HorizonResult } from '../../app/components/PerformanceGrid';
import simbaData from '../data/simba_returns.json';
import { TODAY_ANCHOR, getTrailingYearStart } from './referenceDates';
import { AuditReport, LeakageRow, Coordinates } from '../types/audit';
import { getStrategyEvolution } from './strategyEvolution';
import { solveEfficientFrontier } from './math/mvoBridge';
import { generateSimulationHash, getCachedMVO, saveCachedMVO } from './simulationCache';

export async function generateAuditReport(): Promise<AuditReport> {
    const metrics = calculateHierarchicalMetrics();
    const perf1y = calculatePortfolioPerformance();
    const efficiency = calculatePortfolioEfficiency();
    const targetTree = getAllocationTree();
    const targetWeightsFlat = flattenLeafWeights(targetTree as any);
    const taxIssues = getTaxPlacementIssues() ?? [];
    const feeRisks = getExpenseRisks() ?? [];
    const concentrationRisks = getConcentrationRisks() ?? [];

    const accountCount = db.prepare("SELECT COUNT(*) as c FROM accounts").get() as { c: number };
    const tv = metrics?.reduce((acc, m) => m.level === 0 ? acc + m.actualValue : acc, 0) ?? 0;

    const currentWeights: Record<string, number> = {};
    metrics?.forEach(m => {
        if (m.level === 2 || m.label === 'Cash') {
            if (m.actualPortfolio > 0) {
                currentWeights[m.label] = (currentWeights[m.label] || 0) + m.actualPortfolio;
            }
        }
    });

    const horizons: HorizonResult[] = [];

    // ── 1. 1Y ACTUAL (Daily Real Data) ──────────────────────────────────────
    const startDate = getTrailingYearStart();
    const vti1yRaw = db.prepare("SELECT close FROM price_history WHERE ticker = 'VTI' AND date >= ? AND date <= ? ORDER BY date ASC").all(startDate, TODAY_ANCHOR) as any[];
    const vtiRet1y = vti1yRaw.length >= 2 ? (vti1yRaw[vti1yRaw.length-1].close / vti1yRaw[0].close) - 1 : 0;
    const target1ySim = calculateHistoricalProxyReturns(targetWeightsFlat, 1);

    horizons.push({
        horizon: '1Y ACTUAL',
        isProxy: false,
        marketReturn: vtiRet1y,
        marketSharpe: 0.5, // 1Y approx
        targetReturn: target1ySim.annualizedReturn,
        targetSharpe: target1ySim.sharpe,
        targetM2VsVti: target1ySim.m2 - vtiRet1y,
        targetAlphaVsVti: 0, 
        targetCapture: null,
        portfolioReturn: perf1y.return1y ?? 0,
        portfolioSharpe: perf1y.sharpe ?? 0,
        portfolioM2VsVti: (perf1y.m2 || 0) - vtiRet1y,
        portfolioAlphaVsVti: perf1y.alpha ?? 0,
        portfolioCapture: [perf1y.upsideCapture ?? 0, perf1y.downsideCapture ?? 0],
        m2DeltaVsTarget: (perf1y.m2 || 0) - target1ySim.m2,
        annualDollarLoss: (target1ySim.annualizedReturn - (perf1y.return1y || 0)) * tv
    });

    // ── 2. 3Y HISTORICAL (Simba Proxy) ──────────────────────────────────────
    const port3 = calculateHistoricalProxyReturns(currentWeights, 3);
    const target3 = calculateHistoricalProxyReturns(targetWeightsFlat, 3);
    horizons.push({
        horizon: '3Y HISTORICAL',
        isProxy: true,
        marketReturn: port3.marketReturn,
        marketSharpe: (port3.marketReturn - 0.05) / (port3.marketVol || 1),
        targetReturn: target3.annualizedReturn,
        targetSharpe: target3.sharpe,
        targetM2VsVti: target3.m2 - target3.marketReturn,
        targetAlphaVsVti: target3.annualizedReturn - (0.05 + (target3.volatility/target3.marketVol) * (target3.marketReturn - 0.05)),
        targetCapture: null,
        portfolioReturn: port3.annualizedReturn,
        portfolioSharpe: port3.sharpe,
        portfolioM2VsVti: port3.m2 - port3.marketReturn,
        portfolioAlphaVsVti: port3.annualizedReturn - (0.05 + (port3.volatility/port3.marketVol) * (port3.marketReturn - 0.05)),
        portfolioCapture: null,
        m2DeltaVsTarget: port3.m2 - target3.m2,
        annualDollarLoss: (target3.annualizedReturn - port3.annualizedReturn) * tv
    });

    // ── 3. FULL HISTORY (Simba Proxy - Basis for Frontier Chart) ──────────────
    const portFull = calculateHistoricalProxyReturns(currentWeights, 50);
    const targetFull = calculateHistoricalProxyReturns(targetWeightsFlat, 50);
    
    // Mathematically align volatility with the MVO solver (exactly 50 years sample std dev)
    const stdDev = (arr: number[]) => {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return Math.sqrt(arr.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / arr.length);
    };

    const portFullVol = stdDev(portFull.annualReturns);
    const targetFullVol = stdDev(targetFull.annualReturns);
    
    // We need VTI returns for the exact same 50 years to align Market dot
    const vtiRet50 = portFull.years.map(y => (simbaData as any).asset_classes['VTI']?.returns[y] ?? (simbaData as any).asset_classes['TSM']?.returns[y] ?? 0);
    const vtiFullVol = stdDev(vtiRet50);

    horizons.push({
        horizon: 'FULL HISTORY',
        isProxy: true,
        marketReturn: portFull.marketReturn,
        marketSharpe: (portFull.marketReturn - 0.05) / (portFull.marketVol || 1),
        targetReturn: targetFull.annualizedReturn,
        targetSharpe: targetFull.sharpe,
        targetM2VsVti: targetFull.m2 - targetFull.marketReturn,
        targetAlphaVsVti: targetFull.annualizedReturn - (0.05 + (targetFull.volatility/targetFull.marketVol) * (targetFull.marketReturn - 0.05)),
        targetCapture: null,
        portfolioReturn: portFull.annualizedReturn,
        portfolioSharpe: portFull.sharpe,
        portfolioM2VsVti: portFull.m2 - portFull.marketReturn,
        portfolioAlphaVsVti: portFull.annualizedReturn - (0.05 + (portFull.volatility/portFull.marketVol) * (portFull.marketReturn - 0.05)),
        portfolioCapture: null,
        m2DeltaVsTarget: portFull.m2 - targetFull.m2,
        annualDollarLoss: (targetFull.annualizedReturn - portFull.annualizedReturn) * tv
    });

    const coordinates = {
        vti: { label: 'Market (VTI)', return: portFull.marketReturn, vol: vtiFullVol },
        target: { label: 'Strategy (Target)', return: targetFull.annualizedReturn, vol: targetFullVol },
        actual: { label: 'Portfolio (Actual)', return: portFull.annualizedReturn, vol: portFullVol }
    };

    const simbaClasses = (simbaData as any).asset_classes;
    const getRet = (key: string) => simbaClasses[key]?.returns['2025'] ?? 0;

    const ledger: LeakageRow[] = metrics
        ?.filter(m => m.level === 1)
        .map(m => {
            const drift = m.actualPortfolio - m.expectedPortfolio;
            const simbaKey = LABEL_TO_SIMBA[m.label] || 'TSM';
            const mktRet = getRet(simbaKey);
            const dollarImpact = -drift * mktRet * tv;
            return {
                label: m.label, weight: drift, marketReturn: mktRet, dollarImpact
            };
        }) || [];

    const strategyHistory = getStrategyEvolution();

    // --- 5. EFFICIENT FRONTIER MVO BRIDGE ---
    const GLOBAL_STRATEGIC_UNIVERSE = ['TSM', 'INTL', 'SCV', 'EM', 'REIT', 'ITT'];

    const localAssets = new Set<string>();
    metrics?.forEach(m => {
        if (m.level === 2 || m.label === 'Cash') {
            const simbaClass = TICKER_TO_SIMBA[m.label.toUpperCase()] || LABEL_TO_SIMBA[m.label];
            if (simbaClass && simbaClass !== 'Cash') localAssets.add(simbaClass);
        }
    });
    Object.keys(targetWeightsFlat).forEach(key => {
        const simbaClass = TICKER_TO_SIMBA[key.toUpperCase()] || LABEL_TO_SIMBA[key];
        if (simbaClass && simbaClass !== 'Cash') localAssets.add(simbaClass);
    });

    const assetClasses = (simbaData as any).asset_classes;
    const availableYears = Object.keys(assetClasses.TSM.returns).sort((a, b) => parseInt(a) - parseInt(b));
    const targetYears = availableYears.slice(-50);

    async function getFrontier(universe: string[] | Set<string>) {
        const returnMatrix: Record<string, number[]> = {};
        universe.forEach(asset => {
            returnMatrix[asset] = targetYears.map(year => {
                const cls = assetClasses[asset];
                if (cls && cls.returns && cls.returns[year] !== undefined) return cls.returns[year];
                if (['INTL', 'EM', 'SCV', 'REIT', 'LCB'].includes(asset)) return assetClasses['TSM']?.returns[year] ?? 0;
                if (['ITT'].includes(asset)) return assetClasses['ITT']?.returns[year] ?? 0;
                return 0;
            });
        });

        const cacheHash = generateSimulationHash(returnMatrix, 'MVO_FRONTIER', TODAY_ANCHOR);
        const cachedMVO = getCachedMVO(cacheHash);

        if (cachedMVO) return cachedMVO;
        try {
            const result = await solveEfficientFrontier(returnMatrix);
            saveCachedMVO(cacheHash, result);
            return result;
        } catch (e) {
            console.error("MVO Bridge Failed:", e);
            return { points: [{ vol: 0.15, return: 0.08, isCurve: true }], cloud: [] };
        }
    }

    const frontierPoints = await getFrontier(localAssets.size > 0 ? localAssets : ['TSM']);
    const globalFrontierData = await getFrontier(GLOBAL_STRATEGIC_UNIVERSE);
    const globalFrontierPoints = { points: globalFrontierData.points };

    return {
        tv,
        accountCount: accountCount.c,
        latestPriceDate: TODAY_ANCHOR,
        efficiency,
        horizons,
        leakageLedger: ledger,
        coordinates,
        frontierPoints, 
        globalFrontierPoints,
        taxIssues,
        feeRisks,
        concentrationRisks,
        currentCagr: horizons[0].portfolioReturn,
        targetCagr: horizons[0].targetReturn,
        strategyHistory
    };
}
