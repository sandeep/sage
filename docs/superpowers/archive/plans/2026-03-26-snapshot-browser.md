# Snapshot Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Build `/admin/snapshots` — a read-only page surfacing the full holdings ledger history with a headline growth strip, per-snapshot table (mix, drift, growth), row expansion, and a snapshot trail overlay on the Efficiency Map.

**Architecture:** All data flows from `holdings_ledger`, `asset_registry`, `allocation_nodes`, and the new `snapshot_metadata` table via a single `snapshotBrowser.ts` query module. The page is a React Server Component; the table is a thin `'use client'` component for row expansion and label editing only. The Efficiency Map gains a `snapshotTrail` prop rendered as additional scatter dots.

**Tech Stack:** Next.js App Router (RSC + Route Handler), better-sqlite3, Recharts (existing), Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/logic/snapshotBrowser.ts` | All data logic: headline, rows, expansion, trail |
| Create | `src/lib/logic/__tests__/snapshotBrowser.test.ts` | Tests |
| Create | `src/app/admin/snapshots/page.tsx` | RSC — fetch + render |
| Create | `src/app/admin/snapshots/SnapshotTableClient.tsx` | Row expansion + label editing |
| Create | `src/app/api/admin/snapshots/[date]/label/route.ts` | PATCH label endpoint |
| Modify | `src/app/performance/EfficiencyMapClientV2.tsx` | Add `snapshotTrail` prop + dots |
| Modify | `src/app/performance/EfficiencyMapV2.tsx` | Compute trail, pass as prop |
| Modify | `src/app/components/NavBar.tsx` | Add Snapshots nav item |
| Modify | `src/lib/db/__tests__/setup.ts` | Add `holdings_ledger` + `snapshot_metadata` tables |

---

## Task 1: Extend test setup with new tables

**Files:**
- Modify: `src/lib/db/__tests__/setup.ts`

 - [x] **Step 1: Add holdings_ledger and snapshot_metadata to setupTestDb()**

Open `src/lib/db/__tests__/setup.ts`. Add these two `CREATE TABLE IF NOT EXISTS` statements to the `db.exec` block in `setupTestDb()` (after the `user_settings` table), and add `DELETE FROM` entries in the clear block:

```ts
// In the CREATE block, after user_settings:
        CREATE TABLE IF NOT EXISTS holdings_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_date TEXT NOT NULL,
            account_id TEXT NOT NULL,
            ticker TEXT NOT NULL,
            quantity REAL NOT NULL,
            cost_basis REAL,
            asset_type TEXT NOT NULL,
            market_value REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS snapshot_metadata (
            snapshot_date TEXT PRIMARY KEY,
            label TEXT
        );
```

```ts
// In the DELETE block, after user_settings:
        DELETE FROM holdings_ledger;
        DELETE FROM snapshot_metadata;
```

 - [x] **Step 2: Verify existing tests still pass**

```bash
npx vitest run src/lib/logic/__tests__/simbaEngine.test.ts
```

Expected: all green, no schema errors.

 - [x] **Step 3: Commit**

```bash
git add src/lib/db/__tests__/setup.ts
git commit -m "test: add holdings_ledger and snapshot_metadata to test setup"
```

---

## Task 2: Write snapshotBrowser.ts — types and headline

**Files:**
- Create: `src/lib/logic/snapshotBrowser.ts`
- Create: `src/lib/logic/__tests__/snapshotBrowser.test.ts`

 - [x] **Step 1: Write the failing test for getSnapshotHeadline**

Create `src/lib/logic/__tests__/snapshotBrowser.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db/client';
import { setupTestDb } from '@/lib/db/__tests__/setup';
import { getSnapshotHeadline } from '@/lib/logic/snapshotBrowser';

describe('getSnapshotHeadline', () => {
    beforeEach(() => {
        setupTestDb();
        db.exec(`
            INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'Fidelity', 'ROTH');
        `);
    });

    it('returns null when ledger is empty', () => {
        expect(getSnapshotHeadline()).toBeNull();
    });

    it('returns null when only one snapshot exists', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2024-12-01', 'acc1', 'VTI', 100, 'EQUITY', 20000);
        `);
        expect(getSnapshotHeadline()).toBeNull();
    });

    it('returns headline with correct growth when two snapshots exist', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2024-12-01', 'acc1', 'VTI', 100, 'EQUITY', 20000);
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2025-06-01', 'acc1', 'VTI', 110, 'EQUITY', 25000);
        `);
        const h = getSnapshotHeadline();
        expect(h).not.toBeNull();
        expect(h!.firstDate).toBe('2024-12-01');
        expect(h!.latestDate).toBe('2025-06-01');
        expect(h!.firstValue).toBe(20000);
        expect(h!.latestValue).toBe(25000);
        expect(h!.growthDollars).toBe(5000);
        expect(h!.growthPct).toBeCloseTo(0.25, 4);
        expect(h!.monthsElapsed).toBe(6);
    });
});
```

 - [x] **Step 2: Run test — verify it fails with module not found**

```bash
npx vitest run src/lib/logic/__tests__/snapshotBrowser.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/logic/snapshotBrowser'`

 - [x] **Step 3: Create snapshotBrowser.ts with types and getSnapshotHeadline**

Create `src/lib/logic/snapshotBrowser.ts`:

```ts
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
```

 - [x] **Step 4: Run test — verify getSnapshotHeadline passes**

```bash
npx vitest run src/lib/logic/__tests__/snapshotBrowser.test.ts
```

Expected: all headline tests green.

 - [x] **Step 5: Commit**

```bash
git add src/lib/logic/snapshotBrowser.ts src/lib/logic/__tests__/snapshotBrowser.test.ts
git commit -m "feat(snapshot-browser): types and getSnapshotHeadline"
```

---

## Task 3: snapshotBrowser.ts — getSnapshotRows

**Files:**
- Modify: `src/lib/logic/snapshotBrowser.ts`
- Modify: `src/lib/logic/__tests__/snapshotBrowser.test.ts`

 - [x] **Step 1: Write failing tests for getSnapshotRows**

Append to `src/lib/logic/__tests__/snapshotBrowser.test.ts`:

```ts
import { getSnapshotRows } from '@/lib/logic/snapshotBrowser';

describe('getSnapshotRows', () => {
    beforeEach(() => {
        setupTestDb();
        db.exec(`
            INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'Fidelity', 'ROTH');
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type)
            VALUES ('VTI', 'Vanguard Total Stock', '{"Total Stock Market": 1.0}', 'ETF');
        `);
    });

    it('returns empty array when ledger is empty', () => {
        expect(getSnapshotRows()).toEqual([]);
    });

    it('returns one row with null growth for single snapshot', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2024-12-01', 'acc1', 'VTI', 100, 'EQUITY', 20000);
        `);
        const rows = getSnapshotRows();
        expect(rows).toHaveLength(1);
        expect(rows[0].snapshotDate).toBe('2024-12-01');
        expect(rows[0].totalValue).toBe(20000);
        expect(rows[0].growthDollars).toBeNull();
        expect(rows[0].positionCount).toBe(1);
    });

    it('returns two rows ordered newest first with growth on the latest', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2024-12-01', 'acc1', 'VTI', 100, 'EQUITY', 20000);
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2025-06-01', 'acc1', 'VTI', 110, 'EQUITY', 25000);
        `);
        const rows = getSnapshotRows();
        expect(rows[0].snapshotDate).toBe('2025-06-01');
        expect(rows[0].growthDollars).toBe(5000);
        expect(rows[0].growthPct).toBeCloseTo(0.25, 4);
        expect(rows[1].growthDollars).toBeNull();
    });

    it('computes stock-heavy mix for VTI portfolio', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2025-01-01', 'acc1', 'VTI', 100, 'EQUITY', 10000);
        `);
        const rows = getSnapshotRows();
        expect(rows[0].mix.stockPct).toBe(100);
        expect(rows[0].mix.bondPct).toBe(0);
    });
});
```

 - [x] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/lib/logic/__tests__/snapshotBrowser.test.ts
```

Expected: FAIL — `getSnapshotRows is not a function`

 - [x] **Step 3: Add getSnapshotRows to snapshotBrowser.ts**

Append to `src/lib/logic/snapshotBrowser.ts` (after `getSnapshotHeadline`):

```ts
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
```

 - [x] **Step 4: Run tests — verify all pass**

```bash
npx vitest run src/lib/logic/__tests__/snapshotBrowser.test.ts
```

Expected: all green.

 - [x] **Step 5: Commit**

```bash
git add src/lib/logic/snapshotBrowser.ts src/lib/logic/__tests__/snapshotBrowser.test.ts
git commit -m "feat(snapshot-browser): getSnapshotRows with mix and drift"
```

---

## Task 4: snapshotBrowser.ts — getSnapshotExpansion and getSnapshotTrail

**Files:**
- Modify: `src/lib/logic/snapshotBrowser.ts`
- Modify: `src/lib/logic/__tests__/snapshotBrowser.test.ts`

 - [x] **Step 1: Write failing tests**

Append to `src/lib/logic/__tests__/snapshotBrowser.test.ts`:

```ts
import { getSnapshotExpansion, getSnapshotTrail } from '@/lib/logic/snapshotBrowser';

describe('getSnapshotExpansion', () => {
    beforeEach(() => {
        setupTestDb();
        db.exec(`
            INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'Fidelity', 'ROTH');
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type)
            VALUES ('VTI', 'Vanguard Total Stock', '{"Total Stock Market": 1.0}', 'ETF');
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2025-01-01', 'acc1', 'VTI', 100, 'EQUITY', 10000);
        `);
    });

    it('returns holdings with correct weight', () => {
        const exp = getSnapshotExpansion('2025-01-01', null);
        expect(exp.holdings).toHaveLength(1);
        expect(exp.holdings[0].ticker).toBe('VTI');
        expect(exp.holdings[0].weightPct).toBeCloseTo(100, 1);
    });

    it('returns empty movers when no previous snapshot', () => {
        const exp = getSnapshotExpansion('2025-01-01', null);
        expect(exp.movers).toHaveLength(0);
    });

    it('returns movers when previous snapshot exists', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2024-12-01', 'acc1', 'VTI', 80, 'EQUITY', 8000);
        `);
        const exp = getSnapshotExpansion('2025-01-01', '2024-12-01');
        // VTI was 100% in both, so delta is 0
        expect(exp.movers).toHaveLength(1);
        expect(exp.movers[0].deltaPct).toBeCloseTo(0, 1);
    });
});

describe('getSnapshotTrail', () => {
    beforeEach(() => {
        setupTestDb();
        db.exec(`
            INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'Fidelity', 'ROTH');
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type)
            VALUES ('VTI', 'Vanguard Total Stock', '{"Total Stock Market": 1.0}', 'ETF');
        `);
    });

    it('returns empty array when ledger is empty', () => {
        expect(getSnapshotTrail()).toEqual([]);
    });

    it('returns one point per snapshot with numeric return and vol', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2025-01-01', 'acc1', 'VTI', 100, 'EQUITY', 10000);
        `);
        const trail = getSnapshotTrail();
        expect(trail).toHaveLength(1);
        expect(typeof trail[0].return).toBe('number');
        expect(typeof trail[0].vol).toBe('number');
    });
});
```

 - [x] **Step 2: Run — verify fails**

```bash
npx vitest run src/lib/logic/__tests__/snapshotBrowser.test.ts
```

Expected: FAIL — `getSnapshotExpansion is not a function`

 - [x] **Step 3: Add getSnapshotExpansion and getSnapshotTrail to snapshotBrowser.ts**

Append to `src/lib/logic/snapshotBrowser.ts`:

```ts
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
```

 - [x] **Step 4: Run all tests**

```bash
npx vitest run src/lib/logic/__tests__/snapshotBrowser.test.ts
```

Expected: all green.

 - [x] **Step 5: Commit**

```bash
git add src/lib/logic/snapshotBrowser.ts src/lib/logic/__tests__/snapshotBrowser.test.ts
git commit -m "feat(snapshot-browser): getSnapshotExpansion and getSnapshotTrail"
```

---

## Task 5: PATCH label API route

**Files:**
- Create: `src/app/api/admin/snapshots/[date]/label/route.ts`

 - [x] **Step 1: Create the route**

Create `src/app/api/admin/snapshots/[date]/label/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/client';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ date: string }> }
) {
    const { date } = await params;
    const body = await req.json();
    const label: string | null = typeof body.label === 'string' ? body.label.trim() || null : null;

    db.prepare(`
        INSERT INTO snapshot_metadata (snapshot_date, label)
        VALUES (?, ?)
        ON CONFLICT(snapshot_date) DO UPDATE SET label = excluded.label
    `).run(date, label);

    return NextResponse.json({ ok: true });
}
```

 - [x] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|FAIL" | head -20
```

Expected: no errors involving the new route.

 - [x] **Step 3: Commit**

```bash
git add src/app/api/admin/snapshots/
git commit -m "feat(snapshot-browser): PATCH /api/admin/snapshots/[date]/label"
```

---

## Task 6: SnapshotTableClient component

**Files:**
- Create: `src/app/admin/snapshots/SnapshotTableClient.tsx`

 - [x] **Step 1: Create the component**

Create `src/app/admin/snapshots/SnapshotTableClient.tsx`:

```tsx
'use client';
import React, { useState } from 'react';
import type { SnapshotRow, SnapshotExpansion } from '@/lib/logic/snapshotBrowser';

function formatDate(date: string): string {
    const [year, month] = date.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(month) - 1]} ${year}`;
}

function fmtUSD(v: number): string {
    return `$${Math.round(v).toLocaleString()}`;
}

function fmtPct(v: number): string {
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

function DriftBadge({ score }: { score: number }) {
    const pct = (score * 100).toFixed(1);
    const color = score < 0.03 ? 'text-emerald-400' : score < 0.06 ? 'text-amber-400' : 'text-rose-400';
    return <span className={`font-mono font-black ${color}`}>{pct}%</span>;
}

function MixBar({ stockPct, bondPct, cashPct }: { stockPct: number; bondPct: number; cashPct: number }) {
    return (
        <div className="flex items-center gap-2">
            <div className="flex h-2 w-16 overflow-hidden rounded-sm bg-zinc-900">
                <div className="bg-emerald-500" style={{ width: `${stockPct}%` }} />
                <div className="bg-blue-500" style={{ width: `${bondPct}%` }} />
                <div className="bg-zinc-600" style={{ width: `${cashPct}%` }} />
            </div>
            <span className="ui-caption text-zinc-500">{stockPct}/{bondPct}/{cashPct}</span>
        </div>
    );
}

interface Props {
    rows: SnapshotRow[];
    expansions: Record<string, SnapshotExpansion>;
}

export default function SnapshotTableClient({ rows, expansions }: Props) {
    const [openDate, setOpenDate] = useState<string | null>(null);
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [labels, setLabels] = useState<Record<string, string | null>>(
        Object.fromEntries(rows.map(r => [r.snapshotDate, r.label]))
    );

    const saveLabel = async (date: string) => {
        const trimmed = editValue.trim() || null;
        await fetch(`/api/admin/snapshots/${date}/label`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: trimmed }),
        });
        setLabels(prev => ({ ...prev, [date]: trimmed }));
        setEditingDate(null);
    };

    return (
        <div className="w-full border border-border rounded-sm overflow-x-auto font-mono">
            <table className="w-full border-collapse text-left min-w-[900px]">
                <thead>
                    <tr className="ui-label border-b border-border bg-card text-zinc-500">
                        <th className="px-4 py-3 w-[100px]">Date</th>
                        <th className="px-4 py-3 w-[140px]">Label</th>
                        <th className="px-4 py-3 w-[120px] text-right">Total Value</th>
                        <th className="px-4 py-3 w-[130px] text-right">Δ Growth</th>
                        <th className="px-4 py-3 w-[160px]">Allocation Mix</th>
                        <th className="px-4 py-3 w-[90px]">Drift</th>
                        <th className="px-4 py-3 w-[80px] text-right">Positions</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const isOpen = openDate === row.snapshotDate;
                        const isEditing = editingDate === row.snapshotDate;
                        const exp = expansions[row.snapshotDate];

                        return (
                            <React.Fragment key={row.snapshotDate}>
                                <tr
                                    className="border-b border-border hover:bg-zinc-900/50 cursor-pointer transition-colors"
                                    onClick={() => setOpenDate(isOpen ? null : row.snapshotDate)}
                                >
                                    <td className="px-4 py-3 ui-value text-zinc-300">{formatDate(row.snapshotDate)}</td>
                                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                        {isEditing ? (
                                            <input
                                                autoFocus
                                                className="bg-zinc-900 border border-zinc-700 text-white text-[11px] px-2 py-1 rounded-sm w-full font-mono"
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onBlur={() => saveLabel(row.snapshotDate)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveLabel(row.snapshotDate); if (e.key === 'Escape') setEditingDate(null); }}
                                            />
                                        ) : (
                                            <span
                                                className="ui-caption text-zinc-500 hover:text-zinc-300 cursor-text italic"
                                                onClick={() => { setEditingDate(row.snapshotDate); setEditValue(labels[row.snapshotDate] ?? ''); }}
                                            >
                                                {labels[row.snapshotDate] ?? '—'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 ui-value text-right text-zinc-100">{fmtUSD(row.totalValue)}</td>
                                    <td className="px-4 py-3 text-right">
                                        {row.growthDollars !== null ? (
                                            <span className={`ui-value ${row.growthDollars >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {row.growthDollars >= 0 ? '+' : ''}{fmtUSD(row.growthDollars)}
                                                <span className="ui-caption text-zinc-600 ml-1">({fmtPct(row.growthPct!)})</span>
                                            </span>
                                        ) : (
                                            <span className="ui-caption text-zinc-700 italic">baseline</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3"><MixBar {...row.mix} /></td>
                                    <td className="px-4 py-3"><DriftBadge score={row.driftScore} /></td>
                                    <td className="px-4 py-3 ui-value text-right text-zinc-400">{row.positionCount}</td>
                                </tr>
                                {isOpen && exp && (
                                    <tr className="border-b border-border bg-zinc-950/50">
                                        <td colSpan={7} className="px-6 py-6">
                                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                                {/* Holdings */}
                                                <div className="space-y-3">
                                                    <div className="ui-label text-zinc-500">Holdings</div>
                                                    <table className="w-full text-[10px] font-mono">
                                                        <thead><tr className="ui-caption text-zinc-700"><th className="text-left pb-1">Ticker</th><th className="text-right pb-1">Value</th><th className="text-right pb-1">Weight</th></tr></thead>
                                                        <tbody>
                                                            {exp.holdings.slice(0, 10).map(h => (
                                                                <tr key={h.ticker} className="border-t border-zinc-900">
                                                                    <td className="py-1 text-zinc-300 font-black">{h.ticker}</td>
                                                                    <td className="py-1 text-right text-zinc-500">{fmtUSD(h.marketValue)}</td>
                                                                    <td className="py-1 text-right text-zinc-400">{h.weightPct.toFixed(1)}%</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Movers */}
                                                <div className="space-y-3">
                                                    <div className="ui-label text-zinc-500">Biggest Movers vs Previous</div>
                                                    {exp.movers.length === 0 ? (
                                                        <p className="ui-caption text-zinc-700 italic">Baseline snapshot — no previous to compare</p>
                                                    ) : (
                                                        <table className="w-full text-[10px] font-mono">
                                                            <thead><tr className="ui-caption text-zinc-700"><th className="text-left pb-1">Ticker</th><th className="text-right pb-1">Prev</th><th className="text-right pb-1">Now</th><th className="text-right pb-1">Δ</th></tr></thead>
                                                            <tbody>
                                                                {exp.movers.map(m => (
                                                                    <tr key={m.ticker} className="border-t border-zinc-900">
                                                                        <td className="py-1 text-zinc-300 font-black">{m.ticker}</td>
                                                                        <td className="py-1 text-right text-zinc-600">{m.prevWeightPct.toFixed(1)}%</td>
                                                                        <td className="py-1 text-right text-zinc-400">{m.currWeightPct.toFixed(1)}%</td>
                                                                        <td className={`py-1 text-right font-black ${m.deltaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{m.deltaPct >= 0 ? '+' : ''}{m.deltaPct.toFixed(1)}%</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>

                                                {/* Drift Table */}
                                                <div className="space-y-3">
                                                    <div className="ui-label text-zinc-500">L2 Drift from Target</div>
                                                    <table className="w-full text-[10px] font-mono">
                                                        <thead><tr className="ui-caption text-zinc-700"><th className="text-left pb-1">Asset Class</th><th className="text-right pb-1">Target</th><th className="text-right pb-1">Actual</th><th className="text-right pb-1">Δ</th></tr></thead>
                                                        <tbody>
                                                            {exp.driftTable.slice(0, 8).map(d => (
                                                                <tr key={d.label} className="border-t border-zinc-900">
                                                                    <td className="py-1 text-zinc-400">{d.label}</td>
                                                                    <td className="py-1 text-right text-zinc-600">{d.targetPct.toFixed(1)}%</td>
                                                                    <td className="py-1 text-right text-zinc-400">{d.actualPct.toFixed(1)}%</td>
                                                                    <td className={`py-1 text-right font-black ${Math.abs(d.deltaPct) < 2 ? 'text-zinc-500' : d.deltaPct > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{d.deltaPct >= 0 ? '+' : ''}{d.deltaPct.toFixed(1)}%</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
```

 - [x] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS|Error:" | head -20
```

Expected: no TypeScript errors.

 - [x] **Step 3: Commit**

```bash
git add src/app/admin/snapshots/SnapshotTableClient.tsx
git commit -m "feat(snapshot-browser): SnapshotTableClient with expansion and label editing"
```

---

## Task 7: /admin/snapshots RSC page

**Files:**
- Create: `src/app/admin/snapshots/page.tsx`

 - [x] **Step 1: Create the page**

Create `src/app/admin/snapshots/page.tsx`:

```tsx
import { getSnapshotHeadline, getSnapshotRows, getSnapshotExpansion } from '@/lib/logic/snapshotBrowser';
import SnapshotTableClient from './SnapshotTableClient';

export const dynamic = 'force-dynamic';

function formatDate(date: string): string {
    const [year, month] = date.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(month) - 1]} ${year}`;
}

function fmtUSD(v: number): string {
    return `$${Math.round(v).toLocaleString()}`;
}

export default function SnapshotsPage() {
    const headline = getSnapshotHeadline();
    const rows = getSnapshotRows();

    // Pre-fetch all expansions server-side (local SQLite — fast)
    const expansions = Object.fromEntries(
        rows.map((row, index) => {
            const prevDate = rows[index + 1]?.snapshotDate ?? null;
            return [row.snapshotDate, getSnapshotExpansion(row.snapshotDate, prevDate)];
        })
    );

    return (
        <main className="min-h-screen bg-black text-white font-mono">
            <div className="page-container space-y-16 pb-48 pt-16">

                {/* Headline */}
                <section className="space-y-10">
                    <div className="flex justify-between items-end border-b border-border pb-8">
                        <h2 className="ui-hero">Snapshot History</h2>
                        <div className="ui-label">Portfolio Ledger</div>
                    </div>

                    {headline ? (
                        <div className="grid grid-cols-3 gap-px bg-border border border-border rounded-sm overflow-hidden">
                            <div className="bg-black px-8 py-6 space-y-2">
                                <div className="ui-label text-zinc-500">First Snapshot</div>
                                <div className="ui-metric text-zinc-100">{formatDate(headline.firstDate)}</div>
                                <div className="ui-value text-zinc-600">{fmtUSD(headline.firstValue)}</div>
                            </div>
                            <div className="bg-black px-8 py-6 space-y-2">
                                <div className="ui-label text-zinc-500">Latest Snapshot</div>
                                <div className="ui-metric text-zinc-100">{formatDate(headline.latestDate)}</div>
                                <div className="ui-value text-zinc-600">{fmtUSD(headline.latestValue)}</div>
                            </div>
                            <div className="bg-black px-8 py-6 space-y-2">
                                <div className="ui-label text-zinc-500">Total Growth</div>
                                <div className={`ui-metric ${headline.growthDollars >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {headline.growthDollars >= 0 ? '+' : ''}{fmtUSD(headline.growthDollars)}
                                </div>
                                <div className="ui-value text-zinc-600">
                                    ({headline.growthDollars >= 0 ? '+' : ''}{(headline.growthPct * 100).toFixed(1)}%) over {headline.monthsElapsed} months
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="px-6 py-4 border border-zinc-900 rounded-sm ui-caption text-zinc-700 italic">
                            {rows.length === 0
                                ? 'No snapshots yet. Import holdings to begin.'
                                : 'Import a second snapshot to see growth comparison.'}
                        </div>
                    )}
                </section>

                {/* Table */}
                {rows.length > 0 && (
                    <section className="space-y-8">
                        <div className="ui-label text-zinc-500">All Snapshots</div>
                        <SnapshotTableClient rows={rows} expansions={expansions} />
                    </section>
                )}
            </div>
        </main>
    );
}
```

 - [x] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS|Error:|Route" | head -20
```

Expected: `/admin/snapshots` appears in route list, no errors.

 - [x] **Step 3: Commit**

```bash
git add src/app/admin/snapshots/page.tsx
git commit -m "feat(snapshot-browser): /admin/snapshots RSC page"
```

---

## Task 8: Add Snapshots to NavBar

**Files:**
- Modify: `src/app/components/NavBar.tsx`

 - [x] **Step 1: Add nav item**

In `src/app/components/NavBar.tsx`, update `NAV_ITEMS`:

```ts
const NAV_ITEMS = [
    { href: '/',                    label: 'Dashboard'   },
    { href: '/performance',         label: 'Performance' },
    { href: '/accounts',            label: 'Accounts'    },
    { href: '/admin/snapshots',     label: 'Snapshots'   },
    { href: '/admin/allocation',    label: 'Allocation'  },
];
```

 - [x] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error" | head -10
```

Expected: clean.

 - [x] **Step 3: Commit**

```bash
git add src/app/components/NavBar.tsx
git commit -m "feat(snapshot-browser): add Snapshots to NavBar"
```

---

## Task 9: Efficiency Map snapshot trail overlay

**Files:**
- Modify: `src/app/performance/EfficiencyMapV2.tsx`
- Modify: `src/app/performance/EfficiencyMapClientV2.tsx`

 - [x] **Step 1: Update EfficiencyMapClientV2 to accept and render snapshotTrail**

Open `src/app/performance/EfficiencyMapClientV2.tsx`. Change the `Props` interface and add trail rendering:

```tsx
// Replace the Props interface:
interface Props {
    coordinates: {
        vti: Coordinates;
        target: Coordinates;
        actual: Coordinates;
    };
    snapshotTrail: { date: string; label: string | null; return: number; vol: number }[];
}

// Replace the function signature:
export default function EfficiencyMapClientV2({ coordinates, snapshotTrail }: Props) {
```

Inside the component, add `trailData` after `data`:

```tsx
    const trailData = useMemo(() =>
        snapshotTrail.map((p, i) => ({
            vol: p.vol,
            return: p.return,
            label: p.label ?? p.date.slice(0, 7), // "YYYY-MM"
            fill: '#f59e0b',
            size: 80,
            isTrail: true,
            index: i,
        })),
    [snapshotTrail]);
```

Inside `<ScatterChart>`, after the existing `<Scatter name="Portfolios">` block, add:

```tsx
                        {trailData.length > 0 && (
                            <Scatter
                                name="Snapshots"
                                data={trailData}
                                isAnimationActive={false}
                            >
                                {trailData.map((_, index) => (
                                    <Cell key={`trail-${index}`} fill="#f59e0b" fillOpacity={0.7} />
                                ))}
                                <LabelList dataKey="label" position="top" fill="#f59e0b" fontSize={9} offset={10} />
                            </Scatter>
                        )}
```

 - [x] **Step 2: Update EfficiencyMapV2 to compute and pass trail**

Open `src/app/performance/EfficiencyMapV2.tsx`. Add the import and trail computation:

```tsx
import React from 'react';
import { generateAuditReport } from '@/lib/logic/auditEngine';
import { getSnapshotTrail } from '@/lib/logic/snapshotBrowser';
import EfficiencyMapClientV2 from './EfficiencyMapClientV2';

export default async function EfficiencyMapV2() {
    const report = generateAuditReport();
    const coordinates = report.coordinates;
    const snapshotTrail = getSnapshotTrail();

    return (
        <section className="space-y-12">
            <div className="flex justify-between items-end border-b border-border pb-8">
                <h2 className="ui-hero">Efficiency Map</h2>
                <div className="ui-label">50-Year Probabilistic Risk vs Reward</div>
            </div>
            <EfficiencyMapClientV2 coordinates={coordinates} snapshotTrail={snapshotTrail} />
        </section>
    );
}
```

 - [x] **Step 3: Verify full build is clean**

```bash
npm run build 2>&1 | grep -E "error TS|Error:" | head -20
```

Expected: no TypeScript errors.

 - [x] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all green.

 - [x] **Step 5: Final commit**

```bash
git add src/app/performance/EfficiencyMapV2.tsx src/app/performance/EfficiencyMapClientV2.tsx
git commit -m "feat(snapshot-browser): efficiency map snapshot trail overlay"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Headline strip (first/latest date, total growth, months elapsed, no CAGR)
- ✅ Table rows (date, label, total value, Δ growth, allocation mix bar, drift score, position count)
- ✅ Row expansion (holdings, biggest movers, L2 drift table)
- ✅ Label editing (inline, PATCH API, blur-to-save)
- ✅ Efficient Frontier overlay (snapshotTrail dots on EfficiencyMapV2)
- ✅ Snapshots in NavBar
- ✅ `snapshot_metadata` migration (already done, Task 0 prerequisite)

**Type consistency:**
- `SnapshotTrailPoint` defined in snapshotBrowser.ts, used inline as anonymous type in EfficiencyMapClientV2 — consistent shape `{ date, label, return, vol }`
- `getSnapshotExpansion(snapshotDate, prevDate)` called from page.tsx with `rows[index+1]?.snapshotDate ?? null` — matches signature

**No placeholders:** All steps contain complete code.
