
import crypto from 'crypto';
import db from '../db/client';

export interface SimulationResult {
    totalReturn: number;
    annualizedReturn: number;
    sharpe: number;
    volatility: number;
    maxDrawdown: number;
    m2: number;
}

export interface SimulationSeries {
    date: string;
    value: number;
    drawdown: number;
}

export interface MVOPoint {
    vol: number;
    return: number;
    isCurve: boolean;
}

export interface MVOResponse {
    points: MVOPoint[];
    cloud: MVOPoint[];
}

export function generateSimulationHash(weights: Record<string, any>, horizon: string, anchorDate: string): string {
    // Ensure stable stringification by sorting keys
    const sortedWeights = Object.keys(weights)
        .sort()
        .reduce((acc, key) => {
            acc[key] = weights[key];
            return acc;
        }, {} as Record<string, any>);

    const input = JSON.stringify({ weights: sortedWeights, horizon, anchorDate });
    return crypto.createHash('sha256').update(input).digest('hex');
}

export function getCachedSimulation(hash: string, horizon: string): { results: SimulationResult; series: SimulationSeries[] } | null {
    try {
        const row = db.prepare('SELECT results_json, series_json FROM simulation_cache WHERE hash = ? AND horizon_label = ?').get(hash, horizon) as any;
        if (!row) return null;

        return {
            results: JSON.parse(row.results_json),
            series: JSON.parse(row.series_json)
        };
    } catch (e) {
        console.error('Failed to fetch from simulation_cache', e);
        return null;
    }
}

export function saveCachedSimulation(hash: string, horizon: string, results: SimulationResult, series: SimulationSeries[]) {
    try {
        db.prepare(`
            INSERT OR REPLACE INTO simulation_cache (hash, horizon_label, results_json, series_json, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(hash, horizon, JSON.stringify(results), JSON.stringify(series));
    } catch (e) {
        console.error('Failed to save to simulation_cache', e);
    }
}

// ── MVO SPECIFIC CACHING ───────────────────────────────────────────────────

export function getCachedMVO(hash: string): MVOResponse | null {
    try {
        const row = db.prepare('SELECT results_json FROM simulation_cache WHERE hash = ? AND horizon_label = ?').get(hash, 'MVO_FRONTIER') as any;
        if (!row) return null;
        return JSON.parse(row.results_json);
    } catch (e) {
        console.error('Failed to fetch MVO from cache', e);
        return null;
    }
}

export function saveCachedMVO(hash: string, response: MVOResponse) {
    try {
        db.prepare(`
            INSERT OR REPLACE INTO simulation_cache (hash, horizon_label, results_json, series_json, created_at)
            VALUES (?, 'MVO_FRONTIER', ?, '[]', CURRENT_TIMESTAMP)
        `).run(hash, JSON.stringify(response));
    } catch (e) {
        console.error('Failed to save MVO to cache', e);
    }
}
