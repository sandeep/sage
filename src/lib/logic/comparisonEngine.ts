
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
    { name: 'Inflation Surge', years: [2022] },
];

const YEARLY_SHOCKS: Record<string, { vti: number; scv: number; reit: number; intl: number; bond: number }> = {
    '1987': { vti: -0.33, scv: -0.35, reit: -0.25, intl: -0.28, bond: -0.05 },
    '2020': { vti: -0.34, scv: -0.42, reit: -0.40, intl: -0.33, bond: -0.02 }
};

export function computeCrisisDrawdown(
    annualReturnsByYear: Record<string, number>,
    years: number[],
    isMarket: boolean = false
): number | null {
    if (years.length === 1 && YEARLY_SHOCKS[String(years[0])]) {
        const shock = YEARLY_SHOCKS[String(years[0])];
        if (isMarket) return shock.vti;
        return shock.vti; // Fallback
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
    const { tv } = report;
    
    // THEORETICAL TARGET: Uses strategic weights directly for simulation (Island-agnostic)
    const strategyRows = db.prepare('SELECT category, weight FROM strategy').all() as { category: string, weight: number }[];
    const strategicWeights = Object.fromEntries(strategyRows.map(r => [r.category, r.weight]));
    
    const currentWeights = getPortfolioWeights();

    const vtiSim = calculateHistoricalProxyReturns({ 'VTI': 1 }, 60);
    const targetSim = calculateHistoricalProxyReturns(strategicWeights, 60);
    const actualSim = calculateHistoricalProxyReturns(currentWeights, 60);

    const vtiMetrics = vtiSim ? metricsFromSimba(vtiSim.annualReturns, vtiSim.annualReturns, vtiSim.years) : null;
    const targetMetrics = targetSim && vtiSim ? metricsFromSimba(targetSim.annualReturns, vtiSim.annualReturns, targetSim.years) : null;
    const actualMetrics = actualSim && vtiSim ? metricsFromSimba(actualSim.annualReturns, vtiSim.annualReturns, actualSim.years) : null;

    const crisisData = CRISIS_PERIODS.map(p => ({
        name: p.name,
        years: p.years,
        vti: vtiMetrics ? computeCrisisDrawdown(vtiMetrics.annualReturns, p.years, true) : null,
        target: targetMetrics ? computeCrisisDrawdown(targetMetrics.annualReturns, p.years) : null,
        actual: actualMetrics ? computeCrisisDrawdown(actualMetrics.actualReturns || actualMetrics.annualReturns, p.years) : null,
    }));

    return {
        actual: actualMetrics,
        target: targetMetrics,
        vti: vtiMetrics,
        crisisData,
        totalValue: tv,
        dataNote: "Simba-based metrics are for full-history cycle analysis (60-year trailing window).",
    };
}
