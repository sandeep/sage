
import db from '../db/client';
import { calculateHistoricalProxyReturns } from './simbaEngine';
import { flattenLeafWeights } from './allocationSimulator';

export interface RegimeEvolution {
    label: string;
    startDate: string;
    endDate: string | null;
    nominalReturn: number;
    sharpeRatio: number;
    m2Delta: number;
    improvementReturn: number;
    improvementSharpe: number;
}

/**
 * Historical Strategy Auditor.
 * Simulates every version of the target strategy over the same 50Y cycle
 * to prove whether the plan is actually getting more efficient.
 */
export function getStrategyEvolution(): RegimeEvolution[] {
    const versions = db.prepare(`
        SELECT label, snapshot, start_date, end_date 
        FROM allocation_versions 
        ORDER BY start_date ASC
    `).all() as any[];

    if (versions.length === 0) return [];

    const results: RegimeEvolution[] = [];
    let prevReturn = 0;
    let prevSharpe = 0;

    versions.forEach((v, idx) => {
        const snapshot = JSON.parse(v.snapshot);
        const weights = flattenLeafWeights(snapshot);
        
        // Always simulate over the same 50Y 'Marathon' horizon for a fair comparison
        const sim = calculateHistoricalProxyReturns(weights, 50);

        const currentReturn = sim.annualizedReturn;
        const currentSharpe = sim.sharpe;

        results.push({
            label: v.label,
            startDate: v.start_date,
            endDate: v.end_date,
            nominalReturn: currentReturn,
            sharpeRatio: currentSharpe,
            m2Delta: sim.m2 - sim.marketReturn,
            improvementReturn: idx > 0 ? (currentReturn - prevReturn) : 0,
            improvementSharpe: idx > 0 ? (currentSharpe - prevSharpe) : 0
        });

        prevReturn = currentReturn;
        prevSharpe = currentSharpe;
    });

    return results;
}
