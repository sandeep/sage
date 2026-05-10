
// src/lib/logic/comparisonEngine.ts
import db from '../db/client';
import {
    computeMaxDrawdown,
    computeTrackingError,
    computeInformationRatio,
    computeUpsideCapture,
    computeDownsideCapture,
    navFromAnnualReturns,
} from './performanceMetrics';
import {
    calculateCAGR,
    calculateVolatility,
    computeSharpe,
    computeSortino,
    calculateTWR,
} from './comparison/metricCalculators';
import simbaRaw from '../data/simba_returns.json';
import { SimbaData } from '../types/simba';
import { getStrategicSettings } from '../db/settings';
import { getPortfolioWeights } from './portfolioEngine';
import { calculateHistoricalProxyReturns } from './simbaEngine';
import { generateAuditReport } from './auditEngine';
import { calculateHierarchicalMetrics } from './xray';
import { getAllocationTree } from '../db/allocation';
import { flattenLeafWeights } from './allocationSimulator';

export const simbaData = (simbaRaw as any).asset_classes as SimbaData['asset_classes'];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PortfolioMetrics {
    annualizedReturn: number | null;
    sharpe: number | null;
    sortino: number | null;
    maxDrawdown: number | null;
    volatility: number | null;
    trackingErrorVsVti: number | null;
    informationRatioVsVti: number | null;
    upsideCaptureVsVti: number | null;
    downsideCaptureVsVti: number | null;
    annualReturns: Record<string, number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function recentStartDate(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().split('T')[0];
}

/** Compute the full PortfolioMetrics from a daily NAV + returns vs VTI. */
export function metricsFromNAV(
    dates: string[],
    nav: number[],
    dailyLogReturns: number[],
    vtiLogReturns: number[],
): PortfolioMetrics {
    const settings = getStrategicSettings();
    const DAILY_RF = settings.risk_free_rate / 252;
    const FACTOR = 252;

    const sharpeRaw = computeSharpe(dailyLogReturns, DAILY_RF);
    const sortinoRaw = computeSortino(dailyLogReturns, DAILY_RF);
    const len = Math.min(dailyLogReturns.length, vtiLogReturns.length);

    return {
        annualizedReturn: calculateTWR(nav),
        sharpe:           sharpeRaw !== null ? sharpeRaw * Math.sqrt(FACTOR) : null,
        sortino:          sortinoRaw !== null ? sortinoRaw * Math.sqrt(FACTOR) : null,
        maxDrawdown:      computeMaxDrawdown(nav),
        volatility:       calculateVolatility(dailyLogReturns, FACTOR),
        trackingErrorVsVti:    len >= 2 ? computeTrackingError(dailyLogReturns.slice(0, len), vtiLogReturns.slice(0, len), FACTOR) : null,
        informationRatioVsVti: len >= 2 ? computeInformationRatio(dailyLogReturns.slice(0, len), vtiLogReturns.slice(0, len), FACTOR) : null,
        upsideCaptureVsVti:    len >= 2 ? computeUpsideCapture(dailyLogReturns.slice(0, len), vtiLogReturns.slice(0, len)) : null,
        downsideCaptureVsVti:  len >= 2 ? computeDownsideCapture(dailyLogReturns.slice(0, len), vtiLogReturns.slice(0, len)) : null,
        annualReturns: navToAnnualReturns(dates, nav),
    };
}

export function navToAnnualReturns(
    dates: string[],
    nav: number[],
): Record<string, number> {
    const byYear: Record<string, { first: number; last: number }> = {};
    for (let i = 0; i < dates.length; i++) {
        const year = dates[i].substring(0, 4);
        if (!byYear[year]) byYear[year] = { first: nav[i], last: nav[i] };
        byYear[year].last = nav[i];
    }
    const result: Record<string, number> = {};
    const currentYear = new Date().getFullYear().toString();
    for (const [year, { first, last }] of Object.entries(byYear)) {
        if (year === currentYear) {
            const count = dates.filter(d => d.startsWith(year)).length;
            if (count < 126) continue;
        }
        result[year] = first > 0 ? (last / first) - 1 : 0;
    }
    return result;
}

/** Compute PortfolioMetrics from Simba annual return series. */
export function metricsFromSimba(
    annualReturns: number[],
    vtiAnnualReturns: number[],
    years: number[],
): PortfolioMetrics {
    const settings = getStrategicSettings();
    const ANNUAL_RF = settings.risk_free_rate;
    const FACTOR = 1;
    const nav = navFromAnnualReturns(annualReturns);
    const n = annualReturns.length;

    const len = Math.min(annualReturns.length, vtiAnnualReturns.length);
    const sharpeRaw = computeSharpe(annualReturns, ANNUAL_RF);
    const sortinoRaw = computeSortino(annualReturns, ANNUAL_RF);

    const annualReturnsByYear: Record<string, number> = {};
    years.forEach((y, i) => { annualReturnsByYear[String(y)] = annualReturns[i]; });

    return {
        annualizedReturn: calculateCAGR(nav, n),
        sharpe:    sharpeRaw !== null ? sharpeRaw : null,
        sortino:   sortinoRaw !== null ? sortinoRaw : null,
        maxDrawdown: computeMaxDrawdown(nav),
        volatility: calculateVolatility(annualReturns, FACTOR),
        trackingErrorVsVti:    len >= 2 ? computeTrackingError(annualReturns.slice(0, len), vtiAnnualReturns.slice(0, len), FACTOR) : null,
        informationRatioVsVti: len >= 2 ? computeInformationRatio(annualReturns.slice(0, len), vtiAnnualReturns.slice(0, len), FACTOR) : null,
        upsideCaptureVsVti:   null,
        downsideCaptureVsVti: null,
        annualReturns: annualReturnsByYear,
    };
}

// ── CRISIS PERIODS ────────────────────────────────────────────────────────────

export const CRISIS_PERIODS = [
    { name: 'Stagflation',    years: [1973, 1974] },
    { name: 'Black Monday',   years: [1987] },
    { name: 'Dot-com',        years: [2000, 2001, 2002] },
    { name: 'GFC',            years: [2008] },
    { name: 'COVID-19',       years: [2020] },
    { name: 'Inflation Surge', years: [2022] },
];

const YEARLY_SHOCKS: Record<string, { vti: number; scv: number; reit: number; intl: number; bond: number }> = {
    '1987': { vti: -0.33, scv: -0.35, reit: -0.25, intl: -0.28, bond: -0.05 },
    '2020': { vti: -0.34, scv: -0.42, reit: -0.40, intl: -0.33, bond: -0.02 }
};

import { TICKER_TO_SIMBA, LABEL_TO_SIMBA } from './simbaEngine';
import { SIMBA_MAP } from './allocationSimulator';

export function computeCrisisDrawdown(
    annualReturnsByYear: Record<string, number>,
    years: number[],
    isMarket: boolean = false,
    weights?: Record<string, number>
): number | null {
    if (years.length === 1 && YEARLY_SHOCKS[String(years[0])]) {
        const shock = YEARLY_SHOCKS[String(years[0])];
        if (isMarket) return shock.vti;
        
        if (weights) {
            let weightedShock = 0;
            let totalW = 0;
            for (const [label, weight] of Object.entries(weights)) {
                // Normalize label/ticker to Simba class using the centralized SIMBA_MAP
                const simbaClass = SIMBA_MAP[label] || TICKER_TO_SIMBA[label.toUpperCase()] || LABEL_TO_SIMBA[label] || label;
                const s = simbaClass.toUpperCase();
                
                const shockVal = (s === 'SCV') ? shock.scv :
                                (s === 'REIT') ? shock.reit :
                                (s === 'INTL' || s === 'EM') ? shock.intl :
                                (s === 'BOND' || s === 'ITT') ? shock.bond :
                                shock.vti;
                
                weightedShock += weight * shockVal;
                totalW += weight;
            }
            return totalW > 0 ? weightedShock / totalW : shock.vti;
        }
        return shock.vti;
    }

    const sequence: number[] = [];
    for (const y of years) {
        const r = annualReturnsByYear[String(y)];
        if (r !== undefined) sequence.push(r);
    }
    if (sequence.length === 0) return null;
    const nav = navFromAnnualReturns(sequence);
    return computeMaxDrawdown(nav);
}

// Re-added getComparisonData (Cleaned up from legacy Map logic)
export async function getComparisonData(tab: string) {
    const report = await generateAuditReport();
    const { tv, horizons, coordinates } = report;
    
    // Extract weights directly from the audit metrics (The Truth)
    // This matches how EfficiencyMap gets its weights
    const metrics = calculateHierarchicalMetrics();
    const currentWeights: Record<string, number> = {};
    metrics?.forEach(m => {
        if (m.level === 2 || m.label === 'Cash') {
            if (m.actualPortfolio > 0) {
                currentWeights[m.label] = m.actualPortfolio;
            }
        }
    });

    const targetTree = getAllocationTree();
    const strategicWeights = flattenLeafWeights(targetTree as any);

    const vtiMetrics = horizons.find(h => h.horizon === 'FULL HISTORY')!;
    const targetMetrics = horizons.find(h => h.horizon === 'FULL HISTORY')!;
    const actualMetrics = horizons.find(h => h.horizon === 'FULL HISTORY')!;

    // Helper to get annual returns map
    const getAnnualMap = (horizon: any) => {
        // Since AuditReport doesn't export annualReturns record per horizon yet,
        // we'll use computeCrisisDrawdown fallback for multi-year, 
        // but the intra-year shocks will now have REAL weights.
        return {}; 
    };

    const crisisData = CRISIS_PERIODS.map(p => ({
        name: p.name,
        years: p.years,
        vti: computeCrisisDrawdown((simbaRaw as any).asset_classes['VTI']?.returns || (simbaRaw as any).asset_classes['TSM']?.returns, p.years, true),
        target: computeCrisisDrawdown(report.annualReturns.target, p.years, false, strategicWeights),
        actual: computeCrisisDrawdown(report.annualReturns.actual, p.years, false, currentWeights),
    }));

    return {
        actual: { annualizedReturn: coordinates.actual.return, volatility: coordinates.actual.vol, annualReturns: {} },
        target: { annualizedReturn: coordinates.target.return, volatility: coordinates.target.vol, annualReturns: {} },
        vti: { annualizedReturn: coordinates.vti.return, volatility: coordinates.vti.vol, annualReturns: {} },
        crisisData,
        totalValue: tv,
        dataNote: "Simba-based metrics use a 50-year trailing window for cycle analysis.",
    };
}

/** 
 * Re-implementing low-level helpers missing from recent refactors 
 * to support the Recent performance comparison API.
 */

export function fetchPriceHistory(tickers: string[], start: string, end: string): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const ticker of tickers) {
        const rows = db.prepare("SELECT date, close FROM price_history WHERE ticker = ? AND date >= ? AND date <= ? ORDER BY date").all(ticker, start, end) as any[];
        const map: Record<string, number> = {};
        rows.forEach(r => map[r.date] = r.close);
        out[ticker] = map;
    }
    return out;
}

export function buildActualPortfolioNAV(start: string, end: string): { dates: string[], nav: number[] } | null {
    const allDates = (db.prepare("SELECT DISTINCT date FROM price_history WHERE date >= ? AND date <= ? ORDER BY date ASC").all(start, end) as { date: string }[]).map(r => r.date);
    if (allDates.length < 2) return null;

    // Use current holdings as a static snapshot for historical simulation
    const strategyRows = db.prepare('SELECT category, weight FROM strategy').all() as { category: string, weight: number }[];
    const strategicWeights = Object.fromEntries(strategyRows.map(r => [r.category, r.weight]));
    
    // For "Actual", we use calculateHistoricalProxyReturns to get the series
    const sim = calculateHistoricalProxyReturns(getPortfolioWeights(), 0, allDates.map(d => parseInt(d.substring(0, 4))));
    
    if (!sim || sim.series.length === 0) return null;
    
    return {
        dates: sim.series.map(s => s.date),
        nav: sim.series.map(s => s.value)
    };
}

export function buildNavSeries(
    vtiDates: string[], 
    vtiPrices: number[], 
    targetSim: any, 
    actualNAV: any, 
    proposedSim: any
): any[] {
    const vtiStart = vtiPrices[0] || 1;
    return vtiDates.map((date, i) => ({
        t: date,
        vti: (vtiPrices[i] / vtiStart) * 100,
        target: targetSim && targetSim.series[i] ? (targetSim.series[i].value || 1) * 100 : null,
        actual: actualNAV && actualNAV.nav[i] ? (actualNAV.nav[i] || 1) * 100 : null,
        proposed: proposedSim && proposedSim.series[i] ? (proposedSim.series[i].value || 1) * 100 : null,
    }));
}

