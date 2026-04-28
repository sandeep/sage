import db from '../db/client';
import { getAllocationTree, getAllocationNodes, AllocationNode } from '../db/allocation';
import { calculateHistoricalProxyReturns } from './simbaEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SnapshotHeadline {
    firstDate: string;
    latestDate: string;
    firstValue: number;
    latestValue: number;
    growthDollars: number;
    growthPct: number;
    monthsElapsed: number;
}

export interface AllocationMix {
    stockPct: number;
    bondPct: number;
    cashPct: number;
}

export interface SnapshotRow {
    snapshotDate: string;
    label: string | null;
    totalValue: number;
    prevTotalValue: number | null;
    growthDollars: number | null;
    growthPct: number | null;
    mix: AllocationMix;
    driftScore: number;
    positionCount: number;
}

export interface SnapshotHolding {
    ticker: string;
    quantity: number;
    marketValue: number;
    weightPct: number;
}

export interface SnapshotMover {
    ticker: string;
    prevWeightPct: number;
    currWeightPct: number;
    deltaPct: number;
}

export interface SnapshotDriftRow {
    label: string;
    targetPct: number;
    actualPct: number;
    deltaPct: number;
}

export interface SnapshotExpansion {
    holdings: SnapshotHolding[];
    movers: SnapshotMover[];
    driftTable: SnapshotDriftRow[];
}

export interface SnapshotTrailPoint {
    date: string;
    label: string | null;
    return: number;
    vol: number;
}

// ── Internals ─────────────────────────────────────────────────────────────────

/** Maps every L2 label to its L0 ancestor label (e.g. "Total Stock Market" → "Stock"). */
function buildL2ToL0Map(tree: Record<string, any>): Record<string, string> {
    const map: Record<string, string> = {};
    for (const [l0Label, l0Node] of Object.entries(tree)) {
        const l1Map = (l0Node.categories ?? {}) as Record<string, any>;
        for (const [_l1, l1Node] of Object.entries(l1Map)) {
            const l2Map = (l1Node.subcategories ?? {}) as Record<string, any>;
            for (const l2Label of Object.keys(l2Map)) {
                map[l2Label] = l0Label;
            }
        }
        // L0 nodes with no L1 children (e.g. Cash) map to themselves
        if (Object.keys(l1Map).length === 0) {
            map[l0Label] = l0Label;
        }
    }
    return map;
}

function getHoldingsForDate(snapshotDate: string) {
    return db.prepare(`
        SELECT h.ticker, h.quantity, h.market_value, ar.weights
        FROM holdings_ledger h
        LEFT JOIN asset_registry ar ON h.ticker = ar.ticker
        WHERE h.snapshot_date = ?
    `).all(snapshotDate) as { ticker: string; quantity: number; market_value: number | null; weights: string | null }[];
}

function computeMix(holdings: ReturnType<typeof getHoldingsForDate>, l2ToL0: Record<string, string>): AllocationMix {
    const totalValue = holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
    if (totalValue === 0) return { stockPct: 0, bondPct: 0, cashPct: 0 };

    const l0Totals: Record<string, number> = {};
    for (const h of holdings) {
        const value = h.market_value ?? 0;
        if (value <= 0) continue;
        if (h.weights) {
            const w = JSON.parse(h.weights) as Record<string, number>;
            for (const [l2Label, fraction] of Object.entries(w)) {
                const l0 = l2ToL0[l2Label] ?? 'Stock';
                l0Totals[l0] = (l0Totals[l0] ?? 0) + value * fraction;
            }
        } else {
            l0Totals['Stock'] = (l0Totals['Stock'] ?? 0) + value;
        }
    }

    const stockPct = Math.round(((l0Totals['Stock'] ?? 0) / totalValue) * 100);
    const bondPct = Math.round(((l0Totals['Bond'] ?? 0) / totalValue) * 100);
    const cashPct = 100 - stockPct - bondPct;
    return { stockPct, bondPct, cashPct };
}

function computeDriftScore(holdings: ReturnType<typeof getHoldingsForDate>, l2Targets: AllocationNode[]): number {
    const totalValue = holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
    if (totalValue === 0) return 0;

    const l2Actual: Record<string, number> = {};
    for (const h of holdings) {
        if (!h.weights) continue;
        const w = JSON.parse(h.weights) as Record<string, number>;
        for (const [l2Label, fraction] of Object.entries(w)) {
            l2Actual[l2Label] = (l2Actual[l2Label] ?? 0) + (h.market_value ?? 0) * fraction / totalValue;
        }
    }

    return l2Targets.reduce((sum, node) => sum + Math.abs((l2Actual[node.label] ?? 0) - node.weight), 0);
}

function computeL2Weights(holdings: ReturnType<typeof getHoldingsForDate>): Record<string, number> {
    const totalValue = holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
    if (totalValue === 0) return {};

    const weights: Record<string, number> = {};
    for (const h of holdings) {
        if (!h.weights) continue;
        const w = JSON.parse(h.weights) as Record<string, number>;
        for (const [l2Label, fraction] of Object.entries(w)) {
            weights[l2Label] = (weights[l2Label] ?? 0) + (h.market_value ?? 0) * fraction / totalValue;
        }
    }
    return weights;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns headline growth stats across the full ledger history.
 * Returns null if fewer than 2 snapshots exist.
 */
export function getSnapshotHeadline(): SnapshotHeadline | null {
    const dates = db.prepare(`
        SELECT MIN(snapshot_date) as first_date, MAX(snapshot_date) as latest_date
        FROM holdings_ledger
    `).get() as { first_date: string | null; latest_date: string | null };

    if (!dates.first_date || !dates.latest_date || dates.first_date === dates.latest_date) return null;

    const firstValue = (db.prepare(
        `SELECT COALESCE(SUM(market_value), 0) as total FROM holdings_ledger WHERE snapshot_date = ?`
    ).get(dates.first_date) as any).total as number;

    const latestValue = (db.prepare(
        `SELECT COALESCE(SUM(market_value), 0) as total FROM holdings_ledger WHERE snapshot_date = ?`
    ).get(dates.latest_date) as any).total as number;

    const growthDollars = latestValue - firstValue;
    const growthPct = firstValue > 0 ? growthDollars / firstValue : 0;

    const [fy, fm] = dates.first_date.split('-').map(Number);
    const [ly, lm] = dates.latest_date.split('-').map(Number);
    const monthsElapsed = (ly - fy) * 12 + (lm - fm);

    return { firstDate: dates.first_date, latestDate: dates.latest_date, firstValue, latestValue, growthDollars, growthPct, monthsElapsed };
}

/**
 * Returns one summary row per snapshot date, ordered newest first.
 * Includes growth vs previous snapshot, allocation mix, drift score, and position count.
 */
export function getSnapshotRows(): SnapshotRow[] {
    const summaries = db.prepare(`
        SELECT
            h.snapshot_date,
            sm.label,
            COALESCE(SUM(h.market_value), 0) as total_value,
            COUNT(DISTINCT h.ticker) as position_count
        FROM holdings_ledger h
        LEFT JOIN snapshot_metadata sm ON h.snapshot_date = sm.snapshot_date
        GROUP BY h.snapshot_date
        ORDER BY h.snapshot_date DESC
    `).all() as { snapshot_date: string; label: string | null; total_value: number; position_count: number }[];

    if (summaries.length === 0) return [];

    const tree = getAllocationTree();
    const l2ToL0 = buildL2ToL0Map(tree);
    const l2Targets = getAllocationNodes().filter(n => n.level === 2);

    return summaries.map((row, index) => {
        const prev = summaries[index + 1] ?? null; // DESC order: next = older
        const growthDollars = prev ? row.total_value - prev.total_value : null;
        const growthPct = prev && prev.total_value > 0 ? growthDollars! / prev.total_value : null;
        const holdings = getHoldingsForDate(row.snapshot_date);
        const mix = computeMix(holdings, l2ToL0);
        const driftScore = computeDriftScore(holdings, l2Targets);

        return {
            snapshotDate: row.snapshot_date,
            label: row.label,
            totalValue: row.total_value,
            prevTotalValue: prev?.total_value ?? null,
            growthDollars,
            growthPct,
            mix,
            driftScore,
            positionCount: row.position_count,
        };
    });
}

/**
 * Returns full holdings list, biggest movers vs previous snapshot, and L2 drift table
 * for a given snapshot date.
 * prevDate is the snapshot_date of the preceding snapshot (null if first).
 */
export function getSnapshotExpansion(snapshotDate: string, prevDate: string | null): SnapshotExpansion {
    const holdings = getHoldingsForDate(snapshotDate);
    const totalValue = holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);

    const holdingRows: SnapshotHolding[] = holdings
        .map(h => ({
            ticker: h.ticker,
            quantity: h.quantity,
            marketValue: h.market_value ?? 0,
            weightPct: totalValue > 0 ? ((h.market_value ?? 0) / totalValue) * 100 : 0,
        }))
        .sort((a, b) => b.weightPct - a.weightPct);

    // Movers: compare position weights between curr and prev snapshot
    let movers: SnapshotMover[] = [];
    if (prevDate) {
        const getTickerWeights = (date: string): Record<string, number> => {
            const rows = db.prepare(
                `SELECT ticker, market_value FROM holdings_ledger WHERE snapshot_date = ?`
            ).all(date) as { ticker: string; market_value: number | null }[];
            const total = rows.reduce((s, r) => s + (r.market_value ?? 0), 0);
            if (total === 0) return {};
            return Object.fromEntries(rows.map(r => [r.ticker, ((r.market_value ?? 0) / total) * 100]));
        };
        const curr = getTickerWeights(snapshotDate);
        const prev = getTickerWeights(prevDate);
        const allTickers = new Set([...Object.keys(curr), ...Object.keys(prev)]);
        movers = [...allTickers]
            .map(ticker => ({
                ticker,
                prevWeightPct: prev[ticker] ?? 0,
                currWeightPct: curr[ticker] ?? 0,
                deltaPct: (curr[ticker] ?? 0) - (prev[ticker] ?? 0),
            }))
            .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
            .slice(0, 5);
    }

    // Drift table: L2 actual vs target
    const l2Targets = getAllocationNodes().filter(n => n.level === 2);
    const l2Actual = computeL2Weights(holdings);
    const driftTable: SnapshotDriftRow[] = l2Targets
        .map(node => ({
            label: node.label,
            targetPct: node.weight * 100,
            actualPct: (l2Actual[node.label] ?? 0) * 100,
            deltaPct: ((l2Actual[node.label] ?? 0) - node.weight) * 100,
        }))
        .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

    return { holdings: holdingRows, movers, driftTable };
}

/**
 * Returns (return, vol) coordinates for each snapshot, used to plot the
 * portfolio's historical journey on the Efficiency Map.
 */
export function getSnapshotTrail(): SnapshotTrailPoint[] {
    const snapshots = db.prepare(`
        SELECT DISTINCT h.snapshot_date, sm.label
        FROM holdings_ledger h
        LEFT JOIN snapshot_metadata sm ON h.snapshot_date = sm.snapshot_date
        ORDER BY h.snapshot_date ASC
    `).all() as { snapshot_date: string; label: string | null }[];

    return snapshots.map(snap => {
        const holdings = getHoldingsForDate(snap.snapshot_date);
        const weights = computeL2Weights(holdings);
        const sim = calculateHistoricalProxyReturns(weights, 50);
        return {
            date: snap.snapshot_date,
            label: snap.label,
            return: sim.annualizedReturn,
            vol: sim.volatility,
        };
    });
}
