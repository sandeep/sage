# Performance Comparison Panel — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Add a policy benchmark comparison section to the `/audit` page showing actual portfolio vs current target vs proposed target performance, with ETF-proxy simulation (recent) and Simba historical data (long-run), including a calendar-year return heatmap with VTI deltas.

**Architecture:** Three pure-logic modules (`performanceMetrics.ts`, `allocationSimulator.ts`, static `simba_returns.json`) feed a single API route (`/api/performance/comparison`), consumed by a `'use client'` `ComparisonPanel` component dropped into the existing Server Component audit page. The allocation explorer writes a flattened draft to `sessionStorage`; the panel reads it on mount to optionally show a Proposed column.

**Tech Stack:** Next.js 15 App Router, TypeScript, better-sqlite3, Recharts, Vitest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-03-16-performance-comparison-panel.md`

---

## File Map

| File | Status | Responsibility |
|------|--------|---------------|
| `src/lib/logic/performanceMetrics.ts` | Create | Max drawdown, tracking error, info ratio, upside/downside capture, NAV-from-annual-returns helper |
| `src/lib/logic/__tests__/performanceMetrics.test.ts` | Create | Unit tests for all performanceMetrics functions |
| `src/lib/logic/allocationSimulator.ts` | Create | ETF proxy map, Simba map, flattenLeafWeights, redistributeExcludedWeights, simulateAllocationNAV, simulateSimbaAllocation |
| `src/lib/logic/__tests__/allocationSimulator.test.ts` | Create | Unit tests for redistribution, flattening, and Simba simulation |
| `src/lib/data/simba_returns.json` | Create | Static Simba annual returns data (stub — real data added when user provides Simba spreadsheet) |
| `src/app/api/performance/comparison/route.ts` | Create | GET handler: fetch price history, run simulations, compute all metrics, return structured response |
| `src/app/components/CalendarHeatmap.tsx` | Create | Pure presentational grid: Year \| VTI \| Actual Δ \| Target Δ \| Proposed Δ |
| `src/app/components/ComparisonPanel.tsx` | Create | `'use client'` — owns tab state, window state, sessionStorage read, API fetch, renders metric grid + heatmap + crisis table |
| `src/app/admin/allocation/page.tsx` | Modify | Write flattened draft weights to `sessionStorage` on every slider change |
| `src/app/audit/page.tsx` | Modify | Import and render `<ComparisonPanel />` at the bottom |

---

## Chunk 1: Pure logic layer

### Task 1: Performance metrics library

**Files:**
- Create: `src/lib/logic/performanceMetrics.ts`
- Create: `src/lib/logic/__tests__/performanceMetrics.test.ts`

 - [x] **Step 1: Write failing tests**

Create `src/lib/logic/__tests__/performanceMetrics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
    computeMaxDrawdown,
    computeTrackingError,
    computeInformationRatio,
    computeUpsideCapture,
    computeDownsideCapture,
    navFromAnnualReturns,
} from '../performanceMetrics';

describe('navFromAnnualReturns', () => {
    it('builds cumulative NAV from annual returns', () => {
        const nav = navFromAnnualReturns([0.10, -0.20, 0.15]);
        expect(nav[0]).toBe(1.0);
        expect(nav[1]).toBeCloseTo(1.10);
        expect(nav[2]).toBeCloseTo(0.88);
        expect(nav[3]).toBeCloseTo(1.012);
    });

    it('returns [1.0] for empty input', () => {
        expect(navFromAnnualReturns([])).toEqual([1.0]);
    });
});

describe('computeMaxDrawdown', () => {
    it('returns 0 for monotonically increasing NAV', () => {
        expect(computeMaxDrawdown([1.0, 1.1, 1.2, 1.3])).toBe(0);
    });

    it('computes peak-to-trough correctly', () => {
        // Peak at 1.2, trough at 0.9 → drawdown = (0.9 - 1.2) / 1.2 = -0.25
        const dd = computeMaxDrawdown([1.0, 1.2, 0.9, 1.1]);
        expect(dd).toBeCloseTo(-0.25);
    });

    it('finds the worst drawdown across multiple peaks', () => {
        // Two drawdowns: 1.0→0.8 (−20%) and 1.2→0.85 (−29.2%)
        const dd = computeMaxDrawdown([1.0, 0.8, 1.2, 0.85]);
        expect(dd).toBeCloseTo(-0.292, 2);
    });

    it('returns 0 for single element NAV', () => {
        expect(computeMaxDrawdown([1.0])).toBe(0);
    });
});

describe('computeTrackingError', () => {
    it('returns 0 when returns are identical', () => {
        const r = [0.01, -0.005, 0.02];
        expect(computeTrackingError(r, r, 252)).toBe(0);
    });

    it('annualizes with sqrt(252) for daily data', () => {
        // Excess return constant at 0.01 → std dev = 0 → TE = 0
        const port = [0.02, 0.03, 0.01];
        const bench = [0.01, 0.02, 0.00];
        const te = computeTrackingError(port, bench, 252);
        // excess = [0.01, 0.01, 0.01] → variance = 0 → te = 0
        expect(te).toBe(0);
    });

    it('produces nonzero TE for varying excess returns', () => {
        const port = [0.02, -0.01, 0.03, 0.00];
        const bench = [0.01, 0.01, 0.01, 0.01];
        const te = computeTrackingError(port, bench, 252);
        expect(te).toBeGreaterThan(0);
    });
});

describe('computeInformationRatio', () => {
    it('returns 0 when tracking error is 0', () => {
        const r = [0.01, 0.01, 0.01];
        expect(computeInformationRatio(r, r, 252)).toBe(0);
    });

    it('is positive when portfolio consistently beats benchmark', () => {
        const port = [0.02, 0.015, 0.025, 0.018];
        const bench = [0.01, 0.005, 0.01, 0.008];
        const ir = computeInformationRatio(port, bench, 252);
        expect(ir).toBeGreaterThan(0);
    });
});

describe('computeUpsideCapture', () => {
    it('returns 1.0 when portfolio matches benchmark in up periods', () => {
        const r = [0.05, 0.03, 0.04];
        expect(computeUpsideCapture(r, r)).toBeCloseTo(1.0);
    });

    it('returns 0 when no up periods', () => {
        const bench = [-0.01, -0.02];
        const port  = [-0.005, -0.01];
        expect(computeUpsideCapture(port, bench)).toBe(0);
    });

    it('is less than 1 when portfolio captures less upside than benchmark', () => {
        const port = [0.03, 0.02, 0.04];
        const bench = [0.06, 0.05, 0.07];
        expect(computeUpsideCapture(port, bench)).toBeLessThan(1.0);
    });
});

describe('computeDownsideCapture', () => {
    it('returns 0 when no down periods', () => {
        const bench = [0.01, 0.02];
        const port  = [0.01, 0.02];
        expect(computeDownsideCapture(port, bench)).toBe(0);
    });

    it('is less than 1 when portfolio loses less in down periods (good)', () => {
        const bench = [-0.05, -0.03, -0.04];
        const port  = [-0.02, -0.01, -0.015];
        expect(computeDownsideCapture(port, bench)).toBeLessThan(1.0);
    });
});
```

 - [x] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/lib/logic/__tests__/performanceMetrics.test.ts 2>&1 | tail -20
```

Expected: all tests FAIL with "Cannot find module '../performanceMetrics'"

 - [x] **Step 3: Implement performanceMetrics.ts**

Create `src/lib/logic/performanceMetrics.ts`:

```ts
// src/lib/logic/performanceMetrics.ts
//
// Pure statistical functions for portfolio performance analysis.
// All functions are stateless and operate on arrays of returns or NAV values.
// annualizationFactor: 252 for daily data, 1 for annual data.

/** Reconstruct a cumulative NAV array from a series of annual (or periodic) returns.
 *  NAV starts at 1.0. Used to convert Simba annual return series into a peak-to-trough
 *  drawable series before calling computeMaxDrawdown. */
export function navFromAnnualReturns(annualReturns: number[]): number[] {
    const nav = [1.0];
    for (const r of annualReturns) {
        nav.push(nav[nav.length - 1] * (1 + r));
    }
    return nav;
}

/** Peak-to-trough maximum drawdown on a NAV array.
 *  Returns a negative decimal (e.g. −0.38 for a 38% drawdown), or 0 if NAV never falls. */
export function computeMaxDrawdown(nav: number[]): number {
    if (nav.length < 2) return 0;
    let peak = nav[0];
    let maxDD = 0;
    for (const v of nav) {
        if (v > peak) peak = v;
        if (peak > 0) {
            const dd = (v - peak) / peak;
            if (dd < maxDD) maxDD = dd;
        }
    }
    return maxDD;
}

/** Annualized tracking error: std dev of (portfolio − benchmark) excess returns,
 *  scaled by sqrt(annualizationFactor). */
export function computeTrackingError(
    portfolioReturns: number[],
    benchmarkReturns: number[],
    annualizationFactor: number,
): number {
    const len = Math.min(portfolioReturns.length, benchmarkReturns.length);
    if (len < 2) return 0;
    const excess = Array.from({ length: len }, (_, i) => portfolioReturns[i] - benchmarkReturns[i]);
    const mean = excess.reduce((a, b) => a + b, 0) / len;
    const variance = excess.reduce((a, e) => a + (e - mean) ** 2, 0) / len;
    return Math.sqrt(variance * annualizationFactor);
}

/** Annualized information ratio: annualized mean excess return divided by tracking error. */
export function computeInformationRatio(
    portfolioReturns: number[],
    benchmarkReturns: number[],
    annualizationFactor: number,
): number {
    const len = Math.min(portfolioReturns.length, benchmarkReturns.length);
    if (len < 2) return 0;
    const excess = Array.from({ length: len }, (_, i) => portfolioReturns[i] - benchmarkReturns[i]);
    const meanExcess = excess.reduce((a, b) => a + b, 0) / len;
    const te = computeTrackingError(portfolioReturns, benchmarkReturns, annualizationFactor);
    if (te === 0) return 0;
    return (meanExcess * annualizationFactor) / te;
}

/** Upside capture ratio: geometric mean of portfolio returns / geometric mean of benchmark
 *  returns, restricted to periods where benchmark > 0.
 *  > 1.0 means portfolio captures more upside than benchmark. */
export function computeUpsideCapture(
    portfolioReturns: number[],
    benchmarkReturns: number[],
): number {
    const len = Math.min(portfolioReturns.length, benchmarkReturns.length);
    const up: Array<{ port: number; bench: number }> = [];
    for (let i = 0; i < len; i++) {
        if (benchmarkReturns[i] > 0) up.push({ port: portfolioReturns[i], bench: benchmarkReturns[i] });
    }
    if (up.length === 0) return 0;
    const portGeo  = up.reduce((p, r) => p * (1 + r.port),  1) ** (1 / up.length) - 1;
    const benchGeo = up.reduce((p, r) => p * (1 + r.bench), 1) ** (1 / up.length) - 1;
    return benchGeo === 0 ? 0 : portGeo / benchGeo;
}

/** Downside capture ratio: geometric mean of portfolio returns / geometric mean of benchmark
 *  returns, restricted to periods where benchmark < 0.
 *  < 1.0 means portfolio loses less than benchmark in down periods (good). */
export function computeDownsideCapture(
    portfolioReturns: number[],
    benchmarkReturns: number[],
): number {
    const len = Math.min(portfolioReturns.length, benchmarkReturns.length);
    const down: Array<{ port: number; bench: number }> = [];
    for (let i = 0; i < len; i++) {
        if (benchmarkReturns[i] < 0) down.push({ port: portfolioReturns[i], bench: benchmarkReturns[i] });
    }
    if (down.length === 0) return 0;
    const portGeo  = down.reduce((p, r) => p * (1 + r.port),  1) ** (1 / down.length) - 1;
    const benchGeo = down.reduce((p, r) => p * (1 + r.bench), 1) ** (1 / down.length) - 1;
    return benchGeo === 0 ? 0 : portGeo / benchGeo;
}
```

 - [x] **Step 4: Run tests — expect all pass**

```bash
npx vitest run src/lib/logic/__tests__/performanceMetrics.test.ts 2>&1 | tail -20
```

Expected: all 14 tests PASS.

 - [x] **Step 5: Commit**

```bash
git add src/lib/logic/performanceMetrics.ts src/lib/logic/__tests__/performanceMetrics.test.ts
git commit --no-gpg-sign -m "feat: add performanceMetrics — maxDrawdown, trackingError, infoRatio, capture ratios"
```

---

### Task 2: Allocation simulator library

**Files:**
- Create: `src/lib/logic/allocationSimulator.ts`
- Create: `src/lib/logic/__tests__/allocationSimulator.test.ts`

**Context:** The allocation tree (from `/api/admin/allocation`) has this shape (from `target_allocation.json`):
```json
{
  "Stock": { "weight": 0.98, "categories": {
    "US Stock": { "weight": 0.68, "subcategories": {
      "US Large Cap/SP500/DJIX": { "weight": 0.20, "expected_return": 0.075 },
      "Total Stock Market": { "weight": 0.20, "expected_return": 0.08 }
    }},
    "Intl'l Stock": { "weight": 0.30, "subcategories": { ... }}
  }},
  "Bond": { "weight": 0.02, "categories": {
    "US Aggregate Bond": { "weight": 0.02, "expected_return": 0.045 }
  }},
  "Cash": { "weight": 0.00, "expected_return": 0.02 }
}
```

`flattenLeafWeights` extracts this into `{ "US Large Cap/SP500/DJIX": 0.20, "Total Stock Market": 0.20, ..., "US Aggregate Bond": 0.02, "Cash": 0.00 }`.

 - [x] **Step 1: Write failing tests**

Create `src/lib/logic/__tests__/allocationSimulator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
    flattenLeafWeights,
    redistributeExcludedWeights,
    simulateSimbaAllocation,
    SIMBA_MAP,
    ETF_PROXY_MAP,
} from '../allocationSimulator';

const MINI_TREE = {
    Stock: {
        weight: 0.70,
        categories: {
            'US Stock': {
                weight: 0.50,
                subcategories: {
                    'Total Stock Market': { weight: 0.30, expected_return: 0.08 },
                    'Small Cap Value':    { weight: 0.20, expected_return: 0.10 },
                },
            },
        },
    },
    Bond: {
        weight: 0.20,
        categories: {
            'US Aggregate Bond': { weight: 0.20, expected_return: 0.045 },
        },
    },
    Cash: { weight: 0.10, expected_return: 0.02 },
};

describe('flattenLeafWeights', () => {
    it('extracts level-2 subcategory weights', () => {
        const flat = flattenLeafWeights(MINI_TREE);
        expect(flat['Total Stock Market']).toBeCloseTo(0.30);
        expect(flat['Small Cap Value']).toBeCloseTo(0.20);
    });

    it('extracts level-1 leaf category weights (Bond)', () => {
        const flat = flattenLeafWeights(MINI_TREE);
        expect(flat['US Aggregate Bond']).toBeCloseTo(0.20);
    });

    it('extracts top-level leaf weight (Cash) using the tree key', () => {
        const flat = flattenLeafWeights(MINI_TREE);
        expect(flat['Cash']).toBeCloseTo(0.10);
    });

    it('all weights sum to approximately 1.0', () => {
        const flat = flattenLeafWeights(MINI_TREE);
        const total = Object.values(flat).reduce((a, b) => a + b, 0);
        expect(total).toBeCloseTo(1.0, 5);
    });
});

describe('redistributeExcludedWeights', () => {
    const weights = {
        'Total Stock Market': 0.60,
        'Healthcare': 0.20,        // excluded
        'US Aggregate Bond': 0.20,
    };
    const mapped = ['Total Stock Market', 'US Aggregate Bond'];

    it('identifies excluded labels', () => {
        const result = redistributeExcludedWeights(weights, mapped);
        expect(result.excluded).toContain('Healthcare');
    });

    it('reports excluded weight sum', () => {
        const result = redistributeExcludedWeights(weights, mapped);
        expect(result.excludedWeight).toBeCloseTo(0.20);
    });

    it('rescales mapped weights to sum to 1.0', () => {
        const result = redistributeExcludedWeights(weights, mapped);
        const total = Object.values(result.adjusted).reduce((a, b) => a + b, 0);
        expect(total).toBeCloseTo(1.0, 5);
    });

    it('preserves relative proportions of mapped labels', () => {
        const result = redistributeExcludedWeights(weights, mapped);
        // TSM was 0.60, Bond was 0.20 — ratio 3:1 should be preserved
        const ratio = result.adjusted['Total Stock Market'] / result.adjusted['US Aggregate Bond'];
        expect(ratio).toBeCloseTo(3.0, 5);
    });

    it('returns empty adjusted when all labels are excluded', () => {
        const result = redistributeExcludedWeights(weights, []);
        expect(Object.keys(result.adjusted)).toHaveLength(0);
    });
});

describe('simulateSimbaAllocation', () => {
    // Minimal Simba data covering 2010-2024 (15 years)
    const yearsRange = Array.from({ length: 15 }, (_, i) => 2010 + i);
    const flatReturn = (r: number) => Object.fromEntries(yearsRange.map(y => [String(y), r]));

    const simbaData = {
        TSM:  { label: 'Total Stock Market', returns: flatReturn(0.10) },
        ITT:  { label: 'US Aggregate Bond',  returns: flatReturn(0.02) },
        VTI:  { label: 'VTI Benchmark',      returns: flatReturn(0.10) },
    };

    it('returns weighted annual returns', () => {
        const weights = { 'Total Stock Market': 0.80, 'US Aggregate Bond': 0.20 };
        const result = simulateSimbaAllocation(weights, simbaData);
        expect(result).not.toBeNull();
        // Expected: 0.80*0.10 + 0.20*0.02 = 0.084
        result!.annualReturns.forEach(r => expect(r).toBeCloseTo(0.084));
    });

    it('returns null when fewer than 10 common years', () => {
        const tinySimba = {
            TSM: { label: 'TSM', returns: { '2020': 0.10, '2021': 0.15 } },
        };
        const result = simulateSimbaAllocation({ 'Total Stock Market': 1.0 }, tinySimba);
        expect(result).toBeNull();
    });

    it('excludes unmapped labels and redistributes weights', () => {
        // Healthcare is not in SIMBA_MAP → excluded, TSM gets its weight
        const weights = { 'Total Stock Market': 0.70, 'Healthcare': 0.30 };
        const result = simulateSimbaAllocation(weights, simbaData);
        expect(result).not.toBeNull();
        // After redistribution TSM weight = 1.0 → return = 0.10
        result!.annualReturns.forEach(r => expect(r).toBeCloseTo(0.10));
    });

    it('returns years in ascending order', () => {
        const weights = { 'Total Stock Market': 1.0 };
        const result = simulateSimbaAllocation(weights, simbaData);
        expect(result).not.toBeNull();
        const years = result!.years;
        for (let i = 1; i < years.length; i++) {
            expect(years[i]).toBeGreaterThan(years[i - 1]);
        }
    });
});

describe('ETF_PROXY_MAP and SIMBA_MAP label accuracy', () => {
    it('ETF_PROXY_MAP uses exact allocation tree label for Total Stock Market', () => {
        expect(ETF_PROXY_MAP['Total Stock Market']).toBe('VTI');
    });

    it('ETF_PROXY_MAP uses exact allocation tree label for US Large Cap', () => {
        expect(ETF_PROXY_MAP['US Large Cap/SP500/DJIX']).toBe('VOO');
    });

    it('SIMBA_MAP does not include excluded categories', () => {
        expect(SIMBA_MAP['Healthcare']).toBeUndefined();
        expect(SIMBA_MAP['Energy']).toBeUndefined();
        expect(SIMBA_MAP['Non Big (Ext Market/Small Blend)']).toBeUndefined();
    });
});
```

 - [x] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/lib/logic/__tests__/allocationSimulator.test.ts 2>&1 | tail -20
```

Expected: all tests FAIL with "Cannot find module '../allocationSimulator'"

 - [x] **Step 3: Implement allocationSimulator.ts**

Create `src/lib/logic/allocationSimulator.ts`:

```ts
// src/lib/logic/allocationSimulator.ts
//
// Maps allocation leaf categories to ETF proxies and Simba asset class labels,
// flattens the nested allocation tree to leaf weights, and simulates portfolio NAVs.

// ── Maps ─────────────────────────────────────────────────────────────────────

/** Allocation leaf label → ETF ticker in price_history.
 *  Labels must match EXACTLY what is stored in allocation_nodes / target_allocation.json. */
export const ETF_PROXY_MAP: Record<string, string> = {
    'Total Stock Market':            'VTI',
    'US Large Cap/SP500/DJIX':       'VOO',
    'Small Cap Value':               'VBR',
    'REIT':                          'VNQ',
    'Mid-Cap':                       'VO',
    'Small-Cap':                     'VB',
    'Developed Market':              'VEA',
    'Emerging Market':               'VWO',
    'US Aggregate Bond':             'BND',
    // Excluded (no reliable ETF proxy in price_history):
    //   Healthcare, Energy, Non Big (Ext Market/Small Blend),
    //   Int'l Small Cap, Int'l Value, Total Int'l Stock Market, Cash
};

/** Allocation leaf label → Simba asset class key in simba_returns.json. */
export const SIMBA_MAP: Record<string, string> = {
    'Total Stock Market':       'TSM',
    'US Large Cap/SP500/DJIX':  'LCB',
    'Small Cap Value':          'SCV',
    'REIT':                     'REIT',
    'Developed Market':         'INTL',
    'Emerging Market':          'EM',
    'US Aggregate Bond':        'ITT',
    // All other labels are excluded from Simba simulation.
};

// ── Tree flattening ───────────────────────────────────────────────────────────

/** Convert the nested allocation tree (from /api/admin/allocation) into a flat
 *  Record<label, weight> containing only leaf nodes. Handles all three depths:
 *  - Level 2 subcategories (e.g. "Total Stock Market" under "US Stock" under "Stock")
 *  - Level 1 category leaves (e.g. "US Aggregate Bond" under "Bond" with no subcategories)
 *  - Level 0 top-level leaves (e.g. "Cash" with no categories) */
export function flattenLeafWeights(tree: Record<string, any>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [topKey, topNode] of Object.entries(tree)) {
        if (topNode.categories) {
            for (const [catLabel, catNode] of Object.entries(topNode.categories as Record<string, any>)) {
                if ((catNode as any).subcategories) {
                    for (const [subLabel, subNode] of Object.entries((catNode as any).subcategories as Record<string, any>)) {
                        out[subLabel] = (subNode as any).weight ?? 0;
                    }
                } else {
                    // Level-1 leaf (e.g. US Aggregate Bond)
                    out[catLabel] = (catNode as any).weight ?? 0;
                }
            }
        } else {
            // Top-level leaf (e.g. Cash) — use the tree key as the label
            out[topKey] = topNode.weight ?? 0;
        }
    }
    return out;
}

// ── Weight redistribution ─────────────────────────────────────────────────────

export interface RedistributionResult {
    adjusted: Record<string, number>; // mapped labels → rescaled weights summing to 1.0
    excluded: string[];               // labels not in mappedLabels
    excludedWeight: number;           // sum of excluded weights (before redistribution)
}

/** Remove unmapped leaf labels from the weight map and proportionally rescale
 *  the remaining (mapped) labels so they sum to 1.0.
 *  Redistribution is global — not within-parent. */
export function redistributeExcludedWeights(
    weights: Record<string, number>,
    mappedLabels: string[],
): RedistributionResult {
    const excluded = Object.keys(weights).filter(l => !mappedLabels.includes(l));
    const excludedWeight = excluded.reduce((s, l) => s + (weights[l] ?? 0), 0);
    const totalMapped = mappedLabels.reduce((s, l) => s + (weights[l] ?? 0), 0);
    if (totalMapped === 0) return { adjusted: {}, excluded, excludedWeight };
    const scale = 1 / totalMapped;
    const adjusted = Object.fromEntries(mappedLabels.map(l => [l, (weights[l] ?? 0) * scale]));
    return { adjusted, excluded, excludedWeight };
}

// ── ETF proxy NAV simulation ──────────────────────────────────────────────────

export interface NAVResult {
    dates: string[];
    nav: number[];
    dailyLogReturns: number[];
    excluded: string[];
    excludedWeight: number;
}

/** Simulate a constant-weight daily-rebalanced portfolio NAV using ETF price history.
 *  priceHistory: ticker → date string (YYYY-MM-DD) → closing price.
 *  Returns null if fewer than 60 trading days of data are available. */
export function simulateAllocationNAV(
    weights: Record<string, number>,
    priceHistory: Record<string, Record<string, number>>,
    startDate: string,
    endDate: string,
): NAVResult | null {
    const mapped = Object.keys(weights).filter(l => ETF_PROXY_MAP[l]);
    const { adjusted, excluded, excludedWeight } = redistributeExcludedWeights(weights, mapped);
    if (Object.keys(adjusted).length === 0) return null;

    // Map leaf labels → ticker weights
    const tickerWeights: Record<string, number> = {};
    for (const [label, w] of Object.entries(adjusted)) {
        tickerWeights[ETF_PROXY_MAP[label]] = (tickerWeights[ETF_PROXY_MAP[label]] ?? 0) + w;
    }

    // Find intersection of dates across all tickers within the window
    const tickers = Object.keys(tickerWeights);
    const dateSets = tickers.map(t =>
        new Set(Object.keys(priceHistory[t] ?? {}).filter(d => d >= startDate && d <= endDate))
    );
    const commonDates = Array.from(dateSets[0] ?? new Set<string>())
        .filter(d => dateSets.every(s => s.has(d)))
        .sort();

    if (commonDates.length < 60) return null;

    // Use first common date as base for each ticker
    const basePrices: Record<string, number> = {};
    for (const ticker of tickers) {
        basePrices[ticker] = priceHistory[ticker][commonDates[0]];
    }

    // Constant-weight daily-rebalanced NAV: NAV[t] = Σ(w_i × price_i[t] / price_i[0])
    // Note: this implies daily rebalancing back to initial weights, which slightly
    // overstates diversification benefit. Stated in UI as "constant-weight simulation."
    const nav: number[] = [];
    for (const date of commonDates) {
        let navt = 0;
        for (const [ticker, w] of Object.entries(tickerWeights)) {
            const price = priceHistory[ticker]?.[date];
            const base  = basePrices[ticker];
            if (price != null && base != null && base > 0) {
                navt += w * (price / base);
            }
        }
        nav.push(navt);
    }

    const dailyLogReturns: number[] = [];
    for (let i = 1; i < nav.length; i++) {
        if (nav[i - 1] > 0 && nav[i] > 0) {
            dailyLogReturns.push(Math.log(nav[i] / nav[i - 1]));
        } else {
            dailyLogReturns.push(0);
        }
    }

    return { dates: commonDates, nav, dailyLogReturns, excluded, excludedWeight };
}

// ── Simba annual simulation ───────────────────────────────────────────────────

export interface SimbaResult {
    years: number[];
    annualReturns: number[];
    excluded: string[];
    excludedWeight: number;
}

export interface SimbaData {
    asset_classes: Record<string, { label: string; returns: Record<string, number> }>;
}

/** Simulate a portfolio's annual returns using Simba historical data.
 *  Returns null if fewer than 10 years of common data are available. */
export function simulateSimbaAllocation(
    weights: Record<string, number>,
    simbaData: Record<string, { label: string; returns: Record<string, number> }>,
    startYear?: number,
    endYear?: number,
): SimbaResult | null {
    const mapped = Object.keys(weights).filter(l => SIMBA_MAP[l] && simbaData[SIMBA_MAP[l]]);
    const { adjusted, excluded, excludedWeight } = redistributeExcludedWeights(weights, mapped);
    if (Object.keys(adjusted).length === 0) return null;

    // Find intersection of years across all mapped asset classes
    const yearSets = Object.entries(adjusted).map(([l]) => {
        const key = SIMBA_MAP[l];
        return new Set(Object.keys(simbaData[key]?.returns ?? {}).map(Number));
    });

    const allCommon = Array.from(yearSets[0] ?? new Set<number>())
        .filter(y => yearSets.every(s => s.has(y)))
        .filter(y => (!startYear || y >= startYear) && (!endYear || y <= endYear))
        .sort((a, b) => a - b);

    if (allCommon.length < 10) return null;

    const annualReturns = allCommon.map(year =>
        Object.entries(adjusted).reduce((sum, [l, w]) => {
            const key = SIMBA_MAP[l];
            const r = simbaData[key]?.returns?.[String(year)] ?? 0;
            return sum + w * r;
        }, 0)
    );

    return { years: allCommon, annualReturns, excluded, excludedWeight };
}
```

 - [x] **Step 4: Run tests — expect all pass**

```bash
npx vitest run src/lib/logic/__tests__/allocationSimulator.test.ts 2>&1 | tail -20
```

Expected: all 13 tests PASS.

 - [x] **Step 5: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all existing tests still pass plus the new ones.

 - [x] **Step 6: Commit**

```bash
git add src/lib/logic/allocationSimulator.ts src/lib/logic/__tests__/allocationSimulator.test.ts
git commit --no-gpg-sign -m "feat: add allocationSimulator — flattenLeafWeights, redistributeExcludedWeights, ETF proxy + Simba simulation"
```

---

## Chunk 2: Data and API

### Task 3: Simba returns JSON stub

**Files:**
- Create: `src/lib/data/simba_returns.json`

**Note:** This is a stub with 15 years of approximate real historical annual returns. The project owner will provide the full Simba spreadsheet to generate complete data. The stub is sufficient for development and testing.

 - [x] **Step 1: Create the Simba JSON stub**

Create `src/lib/data/simba_returns.json`:

```json
{
  "source": "Simba Backtesting Spreadsheet (stub — replace with full data)",
  "updated": "2026-03-16",
  "asset_classes": {
    "TSM": {
      "label": "Total Stock Market",
      "returns": {
        "2009": 0.287, "2010": 0.174, "2011": 0.008, "2012": 0.165,
        "2013": 0.335, "2014": 0.126, "2015": 0.005, "2016": 0.127,
        "2017": 0.212, "2018": -0.052, "2019": 0.307, "2020": 0.210,
        "2021": 0.257, "2022": -0.195, "2023": 0.261
      }
    },
    "LCB": {
      "label": "US Large Cap / SP500",
      "returns": {
        "2009": 0.265, "2010": 0.150, "2011": 0.021, "2012": 0.160,
        "2013": 0.324, "2014": 0.136, "2015": 0.014, "2016": 0.120,
        "2017": 0.218, "2018": -0.044, "2019": 0.314, "2020": 0.184,
        "2021": 0.287, "2022": -0.181, "2023": 0.264
      }
    },
    "SCV": {
      "label": "Small Cap Value",
      "returns": {
        "2009": 0.374, "2010": 0.243, "2011": -0.053, "2012": 0.184,
        "2013": 0.389, "2014": 0.042, "2015": -0.076, "2016": 0.316,
        "2017": 0.076, "2018": -0.127, "2019": 0.229, "2020": 0.041,
        "2021": 0.283, "2022": -0.068, "2023": 0.152
      }
    },
    "REIT": {
      "label": "REIT",
      "returns": {
        "2009": 0.282, "2010": 0.278, "2011": 0.083, "2012": 0.176,
        "2013": 0.030, "2014": 0.280, "2015": 0.028, "2016": 0.085,
        "2017": 0.053, "2018": -0.056, "2019": 0.280, "2020": -0.042,
        "2021": 0.406, "2022": -0.261, "2023": 0.124
      }
    },
    "INTL": {
      "label": "Developed Market",
      "returns": {
        "2009": 0.316, "2010": 0.077, "2011": -0.123, "2012": 0.175,
        "2013": 0.227, "2014": -0.049, "2015": -0.003, "2016": 0.010,
        "2017": 0.250, "2018": -0.136, "2019": 0.222, "2020": 0.079,
        "2021": 0.114, "2022": -0.145, "2023": 0.184
      }
    },
    "EM": {
      "label": "Emerging Market",
      "returns": {
        "2009": 0.789, "2010": 0.187, "2011": -0.184, "2012": 0.183,
        "2013": -0.026, "2014": -0.020, "2015": -0.147, "2016": 0.115,
        "2017": 0.374, "2018": -0.144, "2019": 0.185, "2020": 0.183,
        "2021": -0.023, "2022": -0.200, "2023": 0.097
      }
    },
    "ITT": {
      "label": "US Aggregate Bond",
      "returns": {
        "2009": 0.059, "2010": 0.065, "2011": 0.078, "2012": 0.042,
        "2013": -0.020, "2014": 0.059, "2015": 0.005, "2016": 0.025,
        "2017": 0.035, "2018": 0.001, "2019": 0.087, "2020": 0.076,
        "2021": -0.015, "2022": -0.130, "2023": 0.055
      }
    },
    "VTI": {
      "label": "VTI Benchmark",
      "returns": {
        "2009": 0.287, "2010": 0.174, "2011": 0.008, "2012": 0.165,
        "2013": 0.335, "2014": 0.126, "2015": 0.005, "2016": 0.127,
        "2017": 0.212, "2018": -0.052, "2019": 0.307, "2020": 0.210,
        "2021": 0.257, "2022": -0.195, "2023": 0.261
      }
    }
  }
}
```

 - [x] **Step 2: Verify JSON is valid**

```bash
node -e "const d = require('./src/lib/data/simba_returns.json'); console.log('Asset classes:', Object.keys(d.asset_classes).join(', ')); console.log('Years in TSM:', Object.keys(d.asset_classes.TSM.returns).length);"
```

Expected output:
```
Asset classes: TSM, LCB, SCV, REIT, INTL, EM, ITT, VTI
Years in TSM: 15
```

 - [x] **Step 3: Commit**

```bash
git add src/lib/data/simba_returns.json
git commit --no-gpg-sign -m "data: add simba_returns.json stub (2009-2023 approximate returns)"
```

---

### Task 4: Performance comparison API route

**Files:**
- Create: `src/app/api/performance/comparison/route.ts`

**Context:** The route fetches price history from the DB, runs simulations for target and proposed allocations using `allocationSimulator.ts`, reconstructs the actual portfolio NAV from DB (similar to `portfolioEngine.ts`), and computes all metrics using `performanceMetrics.ts`. It uses `calculatePortfolioPerformance()` from `portfolioEngine.ts` for the actual portfolio's Sharpe/Sortino/return (already implemented).

**Window date ranges:**
- `1y`: `date('now', '-1 year')` to today
- `3y`: `date('now', '-3 years')` to today
- `5y`: `date('now', '-5 years')` to today

 - [x] **Step 1: Create the route directory**

```bash
mkdir -p src/app/api/performance/comparison
```

 - [x] **Step 2: Implement the API route**

Create `src/app/api/performance/comparison/route.ts`:

```ts
// src/app/api/performance/comparison/route.ts
//
// GET /api/performance/comparison
// Query params:
//   tab:    'recent' | 'longrun'  (default: 'recent')
//   window: '1y' | '3y' | '5y'   (default: '3y', Recent tab only)
//   draft:  base64url-encoded JSON string of Record<string, number> flat leaf weights (optional)

import { NextRequest } from 'next/server';
import db from '@/lib/db/client';
import {
    flattenLeafWeights,
    simulateAllocationNAV,
    simulateSimbaAllocation,
    ETF_PROXY_MAP,
    type SimbaData,
} from '@/lib/logic/allocationSimulator';
import {
    computeMaxDrawdown,
    computeTrackingError,
    computeInformationRatio,
    computeUpsideCapture,
    computeDownsideCapture,
    navFromAnnualReturns,
} from '@/lib/logic/performanceMetrics';
import { calculateSharpeRatio, calculateSortinoRatio } from '@/lib/logic/alpha';
import simbaRaw from '@/lib/data/simba_returns.json';

const simbaData = simbaRaw.asset_classes as SimbaData['asset_classes'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortfolioMetrics {
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

function windowToStartDate(window: string): string {
    const d = new Date();
    if (window === '1y') d.setFullYear(d.getFullYear() - 1);
    else if (window === '5y') d.setFullYear(d.getFullYear() - 5);
    else d.setFullYear(d.getFullYear() - 3); // default 3y
    return d.toISOString().split('T')[0];
}

/** Fetch all closing prices from price_history for given tickers within the date window.
 *  Returns: ticker → date → close */
function fetchPriceHistory(
    tickers: string[],
    startDate: string,
    endDate: string,
): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const ticker of tickers) {
        const rows = db.prepare(`
            SELECT date, close FROM price_history
            WHERE ticker = ? AND date >= ? AND date <= ?
            ORDER BY date ASC
        `).all(ticker, startDate, endDate) as { date: string; close: number }[];
        if (rows.length > 0) {
            out[ticker] = Object.fromEntries(rows.map(r => [r.date, r.close]));
        }
    }
    return out;
}

/** Reconstruct actual portfolio daily NAV from holdings × price_history for a date window.
 *  Returns NAV array and dates, or null if insufficient data. */
function buildActualPortfolioNAV(
    startDate: string,
    endDate: string,
): { dates: string[]; nav: number[] } | null {
    const holdings = db.prepare(`
        SELECT ticker, SUM(quantity) as quantity, SUM(market_value) as market_value
        FROM holdings GROUP BY ticker
    `).all() as { ticker: string; quantity: number; market_value: number | null }[];

    if (holdings.length === 0) return null;

    const allDates = (db.prepare(`
        SELECT DISTINCT date FROM price_history
        WHERE date >= ? AND date <= ?
        ORDER BY date ASC
    `).all(startDate, endDate) as { date: string }[]).map(r => r.date);

    if (allDates.length < 60) return null;

    // Build price map per ticker with forward-fill
    const priceSeriesMap = new Map<string, Map<string, number>>();
    for (const h of holdings) {
        const priceRows = db.prepare(`
            SELECT date, close FROM price_history
            WHERE ticker = ? AND date >= ? AND date <= ?
            ORDER BY date ASC
        `).all(h.ticker, startDate, endDate) as { date: string; close: number }[];
        const priceByDate = new Map<string, number>(priceRows.map(r => [r.date, r.close]));
        let lastPrice: number | null = null;
        const filled = new Map<string, number>();
        for (const d of allDates) {
            if (priceByDate.has(d)) lastPrice = priceByDate.get(d)!;
            if (lastPrice !== null) filled.set(d, lastPrice);
        }
        priceSeriesMap.set(h.ticker, filled);
    }

    const mvFallback = new Map<string, number>(
        holdings.filter(h => h.market_value != null && h.market_value > 0)
                .map(h => [h.ticker, h.market_value!])
    );

    const nav: number[] = [];
    for (const date of allDates) {
        let navt = 0;
        for (const h of holdings) {
            const price = priceSeriesMap.get(h.ticker)?.get(date);
            if (price !== undefined) {
                navt += (h.quantity || 0) * price;
            } else {
                navt += mvFallback.get(h.ticker) ?? 0;
            }
        }
        nav.push(navt);
    }

    return { dates: allDates, nav };
}

/** Compute annual returns from a daily NAV array + date array by bucketing into calendar years.
 *  Returns Record<yearString, simpleReturn>. In-progress years are included if ≥6 months in. */
function navToAnnualReturns(
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
        // Skip in-progress year if fewer than ~6 months of data
        if (year === currentYear) {
            const count = dates.filter(d => d.startsWith(year)).length;
            if (count < 126) continue; // ~6 months of trading days
        }
        result[year] = first > 0 ? (last / first) - 1 : 0;
    }
    return result;
}

/** Compute the full PortfolioMetrics from a daily NAV + returns vs VTI. */
function metricsFromNAV(
    dates: string[],
    nav: number[],
    dailyLogReturns: number[],
    vtiLogReturns: number[],
    isLongRun: false,
): PortfolioMetrics {
    const DAILY_RF = 0.05 / 252;
    const FACTOR = 252;

    const sharpeRaw = calculateSharpeRatio(dailyLogReturns, DAILY_RF);
    const sortinoRaw = calculateSortinoRatio(dailyLogReturns, DAILY_RF);
    const n = dailyLogReturns.length;
    const mean = n > 0 ? dailyLogReturns.reduce((a, b) => a + b, 0) / n : 0;
    const variance = n > 0 ? dailyLogReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / n : 0;

    const len = Math.min(dailyLogReturns.length, vtiLogReturns.length);

    return {
        annualizedReturn: nav.length >= 2 ? (nav[nav.length - 1] / nav[0]) - 1 : null,
        sharpe:           Number.isFinite(sharpeRaw * Math.sqrt(FACTOR)) ? sharpeRaw * Math.sqrt(FACTOR) : null,
        sortino:          Number.isFinite(sortinoRaw * Math.sqrt(FACTOR)) ? sortinoRaw * Math.sqrt(FACTOR) : null,
        maxDrawdown:      computeMaxDrawdown(nav),
        volatility:       Math.sqrt(variance * FACTOR),
        trackingErrorVsVti:    len >= 2 ? computeTrackingError(dailyLogReturns.slice(0, len), vtiLogReturns.slice(0, len), FACTOR) : null,
        informationRatioVsVti: len >= 2 ? computeInformationRatio(dailyLogReturns.slice(0, len), vtiLogReturns.slice(0, len), FACTOR) : null,
        upsideCaptureVsVti:    len >= 2 ? computeUpsideCapture(dailyLogReturns.slice(0, len), vtiLogReturns.slice(0, len)) : null,
        downsideCaptureVsVti:  len >= 2 ? computeDownsideCapture(dailyLogReturns.slice(0, len), vtiLogReturns.slice(0, len)) : null,
        annualReturns: navToAnnualReturns(dates, nav),
    };
}

/** Compute PortfolioMetrics from Simba annual return series. Upside/Downside capture = null. */
function metricsFromSimba(
    annualReturns: number[],
    vtiAnnualReturns: number[],
    years: number[],
): PortfolioMetrics {
    const ANNUAL_RF = 0.05;
    const FACTOR = 1;
    const nav = navFromAnnualReturns(annualReturns);
    const vtiNav = navFromAnnualReturns(vtiAnnualReturns);
    const n = annualReturns.length;
    const mean = annualReturns.reduce((a, b) => a + b, 0) / n;
    const variance = annualReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / n;

    const len = Math.min(annualReturns.length, vtiAnnualReturns.length);
    const sharpeRaw = calculateSharpeRatio(annualReturns, ANNUAL_RF);
    const sortinoRaw = calculateSortinoRatio(annualReturns, ANNUAL_RF);

    const annualReturnsByYear: Record<string, number> = {};
    years.forEach((y, i) => { annualReturnsByYear[String(y)] = annualReturns[i]; });

    return {
        annualizedReturn: n > 0 ? (nav[nav.length - 1]) ** (1 / n) - 1 : null,
        sharpe:    Number.isFinite(sharpeRaw)  ? sharpeRaw  : null,
        sortino:   Number.isFinite(sortinoRaw) ? sortinoRaw : null,
        maxDrawdown: computeMaxDrawdown(nav),
        volatility: Math.sqrt(variance * FACTOR),
        trackingErrorVsVti:    len >= 2 ? computeTrackingError(annualReturns.slice(0, len), vtiAnnualReturns.slice(0, len), FACTOR) : null,
        informationRatioVsVti: len >= 2 ? computeInformationRatio(annualReturns.slice(0, len), vtiAnnualReturns.slice(0, len), FACTOR) : null,
        upsideCaptureVsVti:   null,  // not meaningful at annual frequency
        downsideCaptureVsVti: null,
        annualReturns: annualReturnsByYear,
    };
}

// ── CRISIS PERIODS ────────────────────────────────────────────────────────────

const CRISIS_PERIODS = [
    { name: 'Great Depression', years: [1929, 1930, 1931, 1932] },
    { name: 'WWII Bear',        years: [1937] },
    { name: 'Oil Crisis',       years: [1973, 1974] },
    { name: 'Black Monday',     years: [1987] },
    { name: 'Dot-com',          years: [2000, 2001, 2002] },
    { name: 'GFC',              years: [2008, 2009] },
    { name: 'COVID Crash',      years: [2020] },
];

function computeCrisisReturn(
    annualReturnsByYear: Record<string, number>,
    years: number[],
): number | null {
    let result = 1;
    let hasData = false;
    for (const y of years) {
        const r = annualReturnsByYear[String(y)];
        if (r !== undefined) { result *= (1 + r); hasData = true; }
    }
    return hasData ? result - 1 : null;
}

// ── ROUTE HANDLER ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const tab    = (searchParams.get('tab') ?? 'recent') as 'recent' | 'longrun';
    const window = (searchParams.get('window') ?? '3y') as '1y' | '3y' | '5y';
    const draftB64 = searchParams.get('draft');

    // Parse optional draft weights
    let draftWeights: Record<string, number> | null = null;
    if (draftB64) {
        try {
            draftWeights = JSON.parse(Buffer.from(draftB64, 'base64url').toString('utf-8'));
        } catch {
            // malformed draft — ignore
        }
    }

    // ── Fetch saved target allocation from DB ──────────────────────────────
    const targetTree = (() => {
        const rows = db.prepare(`
            SELECT label, parent_label, level, weight, expected_return
            FROM allocation_nodes ORDER BY level ASC, label ASC
        `).all() as { label: string; parent_label: string | null; level: number; weight: number; expected_return: number | null }[];

        // Rebuild tree from flat DB rows (mirrors the shape of target_allocation.json)
        // Use the static JSON as a shortcut — it's kept in sync with allocation_nodes by the admin API
        try {
            return require('@/lib/data/target_allocation.json') as Record<string, any>;
        } catch {
            return null;
        }
    })();

    if (!targetTree) {
        return Response.json({ error: 'Could not load target allocation' }, { status: 500 });
    }

    const targetWeights = flattenLeafWeights(targetTree);

    // ── RECENT TAB (ETF proxy daily simulation) ────────────────────────────
    if (tab === 'recent') {
        const startDate = windowToStartDate(window);
        const endDate   = new Date().toISOString().split('T')[0];

        // Fetch all proxy ETF prices + VTI from DB
        const allTickers = [...new Set([...Object.values(ETF_PROXY_MAP), 'VTI'])];
        const priceHistory = fetchPriceHistory(allTickers, startDate, endDate);

        // VTI benchmark returns
        const vtiDates = Object.keys(priceHistory['VTI'] ?? {}).sort();
        if (vtiDates.length < 60) {
            return Response.json({ error: `VTI price history insufficient for ${window} window` }, { status: 400 });
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

        // Target simulation
        const targetSim = simulateAllocationNAV(targetWeights, priceHistory, startDate, endDate);
        const targetMetrics = targetSim
            ? metricsFromNAV(targetSim.dates, targetSim.nav, targetSim.dailyLogReturns, vtiLogReturns, false)
            : null;

        // Proposed simulation
        let proposedMetrics: PortfolioMetrics | null = null;
        let proposedExcluded: string[] = [];
        let proposedExcludedWeight = 0;
        if (draftWeights) {
            const proposedSim = simulateAllocationNAV(draftWeights, priceHistory, startDate, endDate);
            if (proposedSim) {
                proposedMetrics = metricsFromNAV(proposedSim.dates, proposedSim.nav, proposedSim.dailyLogReturns, vtiLogReturns, false);
                proposedExcluded = proposedSim.excluded;
                proposedExcludedWeight = proposedSim.excludedWeight;
            }
        }

        // Actual portfolio NAV
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
            actualMetrics = metricsFromNAV(actualNAV.dates, actualNAV.nav, actualLogReturns, vtiLogReturns, false);
        }

        return Response.json({
            actual:   actualMetrics,
            target:   targetMetrics,
            proposed: proposedMetrics,
            vti: {
                annualReturns:    vtiAnnualReturns,
                annualizedReturn: vtiPrices.length >= 2 ? (vtiPrices[vtiPrices.length - 1] / vtiPrices[0]) - 1 : null,
                maxDrawdown:      computeMaxDrawdown(vtiPrices.map((p, i) => p / vtiPrices[0])),
            },
            excluded:        targetSim?.excluded ?? [],
            excludedWeight:  targetSim?.excludedWeight ?? 0,
            tab:    'recent',
            window,
            dataNote: targetSim && targetSim.excluded.length > 0
                ? `Excludes ${targetSim.excluded.length} sector fund(s) (${(targetSim.excludedWeight * 100).toFixed(1)}% of allocation) — weights redistributed.`
                : null,
        });
    }

    // ── LONG-RUN TAB (Simba annual data) ──────────────────────────────────
    const vtiSimba = simulateSimbaAllocation({ VTI: 1.0 }, { VTI: simbaData['VTI'] } as any);
    const vtiAnnual = vtiSimba ? Object.fromEntries(vtiSimba.years.map((y, i) => [String(y), vtiSimba.annualReturns[i]])) : {};
    const vtiReturnsArr = vtiSimba?.annualReturns ?? [];

    const targetSimba = simulateSimbaAllocation(targetWeights, simbaData);
    const targetMetrics = targetSimba
        ? metricsFromSimba(targetSimba.annualReturns, vtiReturnsArr, targetSimba.years)
        : null;

    let proposedMetrics: PortfolioMetrics | null = null;
    if (draftWeights) {
        const proposedSimba = simulateSimbaAllocation(draftWeights, simbaData);
        if (proposedSimba) {
            proposedMetrics = metricsFromSimba(proposedSimba.annualReturns, vtiReturnsArr, proposedSimba.years);
        }
    }

    // Actual portfolio: no Simba simulation possible — return null
    // (We only have current holdings, not historical holdings for 50+ years)
    const actualMetrics: PortfolioMetrics | null = null;

    // Crisis stress table
    const crisisData = CRISIS_PERIODS.map(c => ({
        name: c.name,
        years: c.years,
        vti:      computeCrisisReturn(vtiAnnual,    c.years),
        target:   targetMetrics   ? computeCrisisReturn(targetMetrics.annualReturns,   c.years) : null,
        proposed: proposedMetrics ? computeCrisisReturn(proposedMetrics.annualReturns, c.years) : null,
        actual:   null, // actual portfolio history not available for historical periods
    }));

    return Response.json({
        actual:   actualMetrics,
        target:   targetMetrics,
        proposed: proposedMetrics,
        vti: {
            annualReturns:    vtiAnnual,
            annualizedReturn: vtiSimba ? vtiSimba.annualReturns.reduce((p, r) => p * (1 + r), 1) ** (1 / vtiSimba.years.length) - 1 : null,
            maxDrawdown:      vtiSimba ? computeMaxDrawdown(navFromAnnualReturns(vtiSimba.annualReturns)) : null,
        },
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
```

 - [x] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "performance/comparison" | head -20
```

Expected: no errors in the route file.

 - [x] **Step 4: Smoke test the API (Recent tab)**

Start the dev server: `npm run dev`

In a separate terminal:
```bash
curl "http://localhost:3000/api/performance/comparison?tab=recent&window=1y" | jq '{actual_return: .actual.annualizedReturn, target_return: .target.annualizedReturn, tab: .tab}'
```

Expected: JSON with numeric values (may be null if price history is limited) and `"tab": "recent"`.

 - [x] **Step 5: Smoke test the API (Long-run tab)**

```bash
curl "http://localhost:3000/api/performance/comparison?tab=longrun" | jq '{target_cagr: .target.annualizedReturn, crisis_count: (.crisisData | length), tab: .tab}'
```

Expected: `crisis_count: 7`, `tab: "longrun"`, `target_cagr` should be a number around 0.10–0.15.

 - [x] **Step 6: Commit**

```bash
git add src/app/api/performance/comparison/route.ts
git commit --no-gpg-sign -m "feat: add /api/performance/comparison route — ETF proxy + Simba simulation, all portfolio metrics"
```

---

## Chunk 3: UI components and wiring

### Task 5: CalendarHeatmap component

**Files:**
- Create: `src/app/components/CalendarHeatmap.tsx`

 - [x] **Step 1: Implement CalendarHeatmap**

Create `src/app/components/CalendarHeatmap.tsx`:

```tsx
'use client';
import React from 'react';

interface CalendarHeatmapProps {
    years: number[];
    vti: Record<number, number>;
    actual: Record<number, number> | null;
    target: Record<number, number> | null;
    proposed: Record<number, number> | null;
}

function cellBg(value: number): string {
    const opacity = Math.min(Math.abs(value) / 0.40, 1.0) * 0.75;
    return value >= 0
        ? `rgba(16,185,129,${opacity.toFixed(3)})`
        : `rgba(239,68,68,${opacity.toFixed(3)})`;
}

function fmtReturn(v: number): string {
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

function fmtDelta(v: number): string {
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

export default function CalendarHeatmap({
    years, vti, actual, target, proposed,
}: CalendarHeatmapProps) {
    const showProposed = proposed !== null;
    const cols = 3 + (showProposed ? 1 : 0);

    return (
        <div style={{ overflowX: 'auto' }}>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `48px 80px repeat(${cols - 1}, 1fr)`,
                    gap: '2px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    minWidth: '420px',
                }}
            >
                {/* Headers */}
                <div />
                <div style={{ padding: '4px 6px', fontWeight: 700, color: '#71717a' }}>VTI</div>
                {actual !== null && (
                    <div style={{ padding: '4px 6px', fontWeight: 700, color: '#10b981' }}>Actual Δ</div>
                )}
                <div style={{ padding: '4px 6px', fontWeight: 700, color: '#6366f1' }}>Target Δ</div>
                {showProposed && (
                    <div style={{ padding: '4px 6px', fontWeight: 700, color: '#f59e0b' }}>Proposed Δ</div>
                )}

                {/* Rows */}
                {[...years].reverse().map(year => {
                    const vtiReturn   = vti[year];
                    const actReturn   = actual?.[year];
                    const tgtReturn   = target?.[year];
                    const propReturn  = proposed?.[year];

                    if (vtiReturn === undefined) return null;

                    return (
                        <React.Fragment key={year}>
                            {/* Year label */}
                            <div style={{ color: '#52525b', display: 'flex', alignItems: 'center', padding: '2px 0' }}>
                                {year}
                            </div>

                            {/* VTI raw return */}
                            <div style={{
                                background: cellBg(vtiReturn),
                                borderRadius: '3px',
                                padding: '5px 8px',
                                fontWeight: 700,
                                color: vtiReturn >= 0 ? '#d1fae5' : '#fee2e2',
                            }}>
                                {fmtReturn(vtiReturn)}
                            </div>

                            {/* Actual delta */}
                            {actual !== null && (
                                <div style={{
                                    background: actReturn !== undefined ? cellBg(actReturn - vtiReturn) : 'transparent',
                                    borderRadius: '3px',
                                    padding: '5px 8px',
                                    fontWeight: 700,
                                    color: actReturn !== undefined
                                        ? (actReturn - vtiReturn >= 0 ? '#86efac' : '#fca5a5')
                                        : '#3f3f46',
                                }}>
                                    {actReturn !== undefined ? fmtDelta(actReturn - vtiReturn) : '—'}
                                </div>
                            )}

                            {/* Target delta */}
                            <div style={{
                                background: tgtReturn !== undefined ? cellBg(tgtReturn - vtiReturn) : 'transparent',
                                borderRadius: '3px',
                                padding: '5px 8px',
                                fontWeight: 700,
                                color: tgtReturn !== undefined
                                    ? (tgtReturn - vtiReturn >= 0 ? '#86efac' : '#fca5a5')
                                    : '#3f3f46',
                            }}>
                                {tgtReturn !== undefined ? fmtDelta(tgtReturn - vtiReturn) : '—'}
                            </div>

                            {/* Proposed delta */}
                            {showProposed && (
                                <div style={{
                                    background: propReturn !== undefined ? cellBg(propReturn - vtiReturn) : 'transparent',
                                    borderRadius: '3px',
                                    padding: '5px 8px',
                                    fontWeight: 700,
                                    color: propReturn !== undefined
                                        ? (propReturn - vtiReturn >= 0 ? '#86efac' : '#fca5a5')
                                        : '#3f3f46',
                                }}>
                                    {propReturn !== undefined ? fmtDelta(propReturn - vtiReturn) : '—'}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
```

 - [x] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "CalendarHeatmap" | head -10
```

Expected: no errors.

 - [x] **Step 3: Commit**

```bash
git add src/app/components/CalendarHeatmap.tsx
git commit --no-gpg-sign -m "feat: add CalendarHeatmap component — year/VTI/delta grid"
```

---

### Task 6: ComparisonPanel component

**Files:**
- Create: `src/app/components/ComparisonPanel.tsx`

This is the main `'use client'` component. It:
1. Reads `sessionStorage.getItem('sage_draft_allocation')` on mount to check for a draft
2. Fetches `/api/performance/comparison` with tab + window + optional draft
3. Renders the tab switcher, metric grid (3 columns), heatmap, and crisis table

 - [x] **Step 1: Implement ComparisonPanel**

Create `src/app/components/ComparisonPanel.tsx`:

```tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import CalendarHeatmap from './CalendarHeatmap';

// ── Types ────────────────────────────────────────────────────────────────────

interface PortfolioMetrics {
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

interface CrisisRow {
    name: string;
    years: number[];
    vti: number | null;
    target: number | null;
    proposed: number | null;
    actual: number | null;
}

interface ComparisonData {
    actual: PortfolioMetrics | null;
    target: PortfolioMetrics | null;
    proposed: PortfolioMetrics | null;
    vti: { annualReturns: Record<string, number>; annualizedReturn: number | null; maxDrawdown: number | null };
    excluded: string[];
    excludedWeight: number;
    crisisData?: CrisisRow[];
    tab: string;
    window: string | null;
    dataNote: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null, suffix = '%', decimals = 2, scale = 100): string {
    if (v === null || v === undefined) return '—';
    return `${(v * scale).toFixed(decimals)}${suffix}`;
}

function fmtDrawdown(v: number | null): string {
    if (v === null) return '—';
    return `${(v * 100).toFixed(1)}%`;
}

function fmtCapture(v: number | null): string {
    if (v === null) return '—';
    return `${(v * 100).toFixed(0)}%`;
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function MetricRow({
    label,
    actual,
    target,
    proposed,
    showProposed,
}: {
    label: string;
    actual: string;
    target: string;
    proposed: string;
    showProposed: boolean;
}) {
    return (
        <div className="grid gap-3 py-1.5 border-b border-zinc-900/60 text-[11px]"
             style={{ gridTemplateColumns: showProposed ? '120px 1fr 1fr 1fr' : '120px 1fr 1fr' }}>
            <div className="text-zinc-600 uppercase tracking-widest text-[9px] flex items-center">{label}</div>
            <div className="font-black text-zinc-200 tabular-nums">{actual}</div>
            <div className="font-black text-indigo-400 tabular-nums">{target}</div>
            {showProposed && <div className="font-black text-amber-400 tabular-nums">{proposed}</div>}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ComparisonPanel() {
    const [tab, setTab]       = useState<'recent' | 'longrun'>('recent');
    const [window, setWindow] = useState<'1y' | '3y' | '5y'>('3y');
    const [data, setData]     = useState<ComparisonData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState<string | null>(null);
    const [draft, setDraft]   = useState<string | null>(null);

    // Read draft from sessionStorage on mount
    useEffect(() => {
        const stored = sessionStorage.getItem('sage_draft_allocation');
        if (stored) setDraft(btoa(stored)); // base64url-encode
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ tab, window });
            if (draft) params.set('draft', draft);
            const res = await fetch(`/api/performance/comparison?${params}`);
            if (!res.ok) {
                const j = await res.json();
                setError(j.error ?? 'Failed to load comparison data');
                setData(null);
            } else {
                setData(await res.json());
            }
        } catch (e) {
            setError('Network error loading comparison');
        } finally {
            setLoading(false);
        }
    }, [tab, window, draft]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const showProposed = data?.proposed !== null && data?.proposed !== undefined;

    // Build heatmap data
    const heatmapYears = data
        ? [...new Set([
            ...Object.keys(data.vti.annualReturns).map(Number),
          ])].sort()
        : [];

    const toYearMap = (rec: Record<string, number> | undefined): Record<number, number> =>
        rec ? Object.fromEntries(Object.entries(rec).map(([y, v]) => [Number(y), v])) : {};

    return (
        <div className="card space-y-6">
            <div className="flex items-center justify-between">
                <div className="label-caption">Policy Benchmark Comparison</div>
                <div className="text-[9px] text-zinc-600 uppercase tracking-widest">
                    Constant-weight simulation vs VTI
                </div>
            </div>

            {/* Tab + Window switcher */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex gap-1">
                    {(['recent', 'longrun'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded transition-colors ${
                                tab === t
                                    ? 'bg-emerald-600 text-white'
                                    : 'border border-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            {t === 'recent' ? 'Recent (ETF Proxy)' : 'Long-Run (Simba)'}
                        </button>
                    ))}
                </div>
                {tab === 'recent' && (
                    <div className="flex gap-1">
                        {(['1y', '3y', '5y'] as const).map(w => (
                            <button
                                key={w}
                                onClick={() => setWindow(w)}
                                className={`px-2 py-1 text-[10px] font-black uppercase rounded transition-colors ${
                                    window === w
                                        ? 'bg-zinc-700 text-white'
                                        : 'border border-zinc-800 text-zinc-600 hover:text-zinc-400'
                                }`}
                            >
                                {w.toUpperCase()}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Column headers */}
            <div className="grid gap-3 text-[9px] font-black uppercase tracking-widest border-b border-zinc-800 pb-2"
                 style={{ gridTemplateColumns: showProposed ? '120px 1fr 1fr 1fr' : '120px 1fr 1fr' }}>
                <div />
                <div className="text-emerald-500">Actual Portfolio</div>
                <div className="text-indigo-400">Current Target</div>
                {showProposed && <div className="text-amber-400">Proposed Target</div>}
            </div>

            {/* Loading / error */}
            {loading && <div className="text-zinc-600 text-[11px]">Computing simulations...</div>}
            {error   && <div className="text-rose-500 text-[11px]">{error}</div>}

            {/* Metric grid */}
            {data && !loading && (
                <div className="space-y-0">
                    <MetricRow
                        label={tab === 'recent' ? `${window.toUpperCase()} Return` : 'CAGR (full history)'}
                        actual={fmt(data.actual?.annualizedReturn ?? null)}
                        target={fmt(data.target?.annualizedReturn ?? null)}
                        proposed={fmt(data.proposed?.annualizedReturn ?? null)}
                        showProposed={showProposed}
                    />
                    <MetricRow
                        label="Sharpe"
                        actual={fmt(data.actual?.sharpe ?? null, '', 2, 1)}
                        target={fmt(data.target?.sharpe ?? null, '', 2, 1)}
                        proposed={fmt(data.proposed?.sharpe ?? null, '', 2, 1)}
                        showProposed={showProposed}
                    />
                    <MetricRow
                        label="Sortino"
                        actual={fmt(data.actual?.sortino ?? null, '', 2, 1)}
                        target={fmt(data.target?.sortino ?? null, '', 2, 1)}
                        proposed={fmt(data.proposed?.sortino ?? null, '', 2, 1)}
                        showProposed={showProposed}
                    />
                    <MetricRow
                        label="Max Drawdown"
                        actual={fmtDrawdown(data.actual?.maxDrawdown ?? null)}
                        target={fmtDrawdown(data.target?.maxDrawdown ?? null)}
                        proposed={fmtDrawdown(data.proposed?.maxDrawdown ?? null)}
                        showProposed={showProposed}
                    />
                    <MetricRow
                        label="Volatility"
                        actual={fmt(data.actual?.volatility ?? null)}
                        target={fmt(data.target?.volatility ?? null)}
                        proposed={fmt(data.proposed?.volatility ?? null)}
                        showProposed={showProposed}
                    />
                    <MetricRow
                        label="Tracking Error"
                        actual={fmt(data.actual?.trackingErrorVsVti ?? null)}
                        target={fmt(data.target?.trackingErrorVsVti ?? null)}
                        proposed={fmt(data.proposed?.trackingErrorVsVti ?? null)}
                        showProposed={showProposed}
                    />
                    <MetricRow
                        label="Info Ratio"
                        actual={fmt(data.actual?.informationRatioVsVti ?? null, '', 2, 1)}
                        target={fmt(data.target?.informationRatioVsVti ?? null, '', 2, 1)}
                        proposed={fmt(data.proposed?.informationRatioVsVti ?? null, '', 2, 1)}
                        showProposed={showProposed}
                    />
                    {tab === 'recent' && (
                        <>
                            <MetricRow
                                label="Upside Capture"
                                actual={fmtCapture(data.actual?.upsideCaptureVsVti ?? null)}
                                target={fmtCapture(data.target?.upsideCaptureVsVti ?? null)}
                                proposed={fmtCapture(data.proposed?.upsideCaptureVsVti ?? null)}
                                showProposed={showProposed}
                            />
                            <MetricRow
                                label="Downside Capture"
                                actual={fmtCapture(data.actual?.downsideCaptureVsVti ?? null)}
                                target={fmtCapture(data.target?.downsideCaptureVsVti ?? null)}
                                proposed={fmtCapture(data.proposed?.downsideCaptureVsVti ?? null)}
                                showProposed={showProposed}
                            />
                        </>
                    )}
                </div>
            )}

            {/* Data note */}
            {data?.dataNote && (
                <div className="text-[10px] text-zinc-600 italic">{data.dataNote}</div>
            )}

            {/* Calendar year heatmap */}
            {data && heatmapYears.length > 0 && (
                <div className="space-y-2 border-t border-zinc-900 pt-4">
                    <div className="text-[10px] text-zinc-600 uppercase tracking-widest">
                        Annual Returns vs VTI
                    </div>
                    <CalendarHeatmap
                        years={heatmapYears}
                        vti={toYearMap(data.vti.annualReturns)}
                        actual={data.actual ? toYearMap(data.actual.annualReturns) : null}
                        target={data.target ? toYearMap(data.target.annualReturns) : null}
                        proposed={showProposed && data.proposed ? toYearMap(data.proposed.annualReturns) : null}
                    />
                </div>
            )}

            {/* Crisis stress table (Long-Run tab only) */}
            {tab === 'longrun' && data?.crisisData && data.crisisData.length > 0 && (
                <div className="space-y-2 border-t border-zinc-900 pt-4">
                    <div className="text-[10px] text-zinc-600 uppercase tracking-widest">Crisis Stress Test</div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '11px' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', color: '#52525b', fontWeight: 700, padding: '4px 8px 4px 0', borderBottom: '1px solid #27272a' }}>Crisis</th>
                                    <th style={{ textAlign: 'right', color: '#71717a', fontWeight: 700, padding: '4px 8px', borderBottom: '1px solid #27272a' }}>VTI</th>
                                    <th style={{ textAlign: 'right', color: '#6366f1', fontWeight: 700, padding: '4px 8px', borderBottom: '1px solid #27272a' }}>Target</th>
                                    {showProposed && <th style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 700, padding: '4px 8px', borderBottom: '1px solid #27272a' }}>Proposed</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {data.crisisData.map(row => (
                                    <tr key={row.name}>
                                        <td style={{ color: '#a1a1aa', padding: '5px 8px 5px 0', borderBottom: '1px solid #1a1a1a' }}>
                                            {row.name}
                                            <span style={{ color: '#3f3f46', fontSize: '9px', marginLeft: '4px' }}>
                                                {row.years[0]}{row.years.length > 1 ? `–${row.years[row.years.length - 1]}` : ''}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '5px 8px', borderBottom: '1px solid #1a1a1a', color: row.vti != null && row.vti < 0 ? '#f87171' : '#86efac', fontWeight: 700 }}>
                                            {row.vti != null ? `${row.vti >= 0 ? '+' : ''}${(row.vti * 100).toFixed(1)}%` : '—'}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '5px 8px', borderBottom: '1px solid #1a1a1a', fontWeight: 700, color: '#6366f1' }}>
                                            {row.target != null
                                                ? `${(row.target * 100).toFixed(1)}% (${row.vti != null ? `${((row.target - row.vti) * 100).toFixed(1)}% ${row.target > row.vti ? '>' : '<'} VTI` : ''})`
                                                : '—'}
                                        </td>
                                        {showProposed && (
                                            <td style={{ textAlign: 'right', padding: '5px 8px', borderBottom: '1px solid #1a1a1a', fontWeight: 700, color: '#f59e0b' }}>
                                                {row.proposed != null
                                                    ? `${(row.proposed * 100).toFixed(1)}% (${row.vti != null ? `${((row.proposed - row.vti) * 100).toFixed(1)}% ${row.proposed > row.vti ? '>' : '<'} VTI` : ''})`
                                                    : '—'}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
```

 - [x] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "ComparisonPanel" | head -10
```

Expected: no errors.

 - [x] **Step 3: Commit**

```bash
git add src/app/components/ComparisonPanel.tsx
git commit --no-gpg-sign -m "feat: add ComparisonPanel — tab switcher, metric grid, heatmap, crisis stress table"
```

---

### Task 7: Wire allocation explorer + audit page

**Files:**
- Modify: `src/app/admin/allocation/page.tsx`
- Modify: `src/app/audit/page.tsx`

 - [x] **Step 1: Add sessionStorage write to allocation explorer**

In `src/app/admin/allocation/page.tsx`, add this helper function before the `AllocationExplorer` component (below the `ACCENT` constant):

```ts
import { flattenLeafWeights } from '@/lib/logic/allocationSimulator';

function writeDraftToSession(tree: Record<string, any>) {
    try {
        const flat = flattenLeafWeights(tree);
        sessionStorage.setItem('sage_draft_allocation', JSON.stringify(flat));
    } catch {
        // sessionStorage not available (SSR edge case)
    }
}
```

Then call `writeDraftToSession(newTree)` at the end of both slider handlers. Update `handleSliderChange`:

```ts
const handleSliderChange = useCallback((label: string, newWeight: number) => {
    setDraftTree(prev => {
        if (!prev) return prev;
        const next = updateLeafWeight(prev, label, newWeight);
        writeDraftToSession(next);
        return next;
    });
    setSaveSuccess(false);
}, []);
```

Update `handleTopLevelSliderChange`:

```ts
const handleTopLevelSliderChange = useCallback((label: string, newWeight: number) => {
    setDraftTree(prev => {
        if (!prev) return prev;
        const next = { ...prev, [label]: { ...(prev[label] as any), weight: newWeight } };
        writeDraftToSession(next);
        return next;
    });
    setSaveSuccess(false);
}, []);
```

 - [x] **Step 2: Type-check allocation page**

```bash
npx tsc --noEmit 2>&1 | grep "admin/allocation" | head -10
```

Expected: no errors.

 - [x] **Step 3: Add ComparisonPanel to audit page**

In `src/app/audit/page.tsx`, add the import at the top of the file (after existing imports):

```ts
import ComparisonPanel from '../components/ComparisonPanel';
```

Add `<ComparisonPanel />` at the very end of the returned JSX, after the existing content. Find the closing `</div>` and `</main>` tags and insert before them:

```tsx
{/* Policy Benchmark Comparison */}
<ComparisonPanel />
```

 - [x] **Step 4: Type-check audit page**

```bash
npx tsc --noEmit 2>&1 | grep "audit/page" | head -10
```

Expected: no errors.

 - [x] **Step 5: Full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all tests pass.

 - [x] **Step 6: Smoke test in browser**

Start dev server: `npm run dev`

Navigate to `http://localhost:3000/audit`.

Verify:
- "Policy Benchmark Comparison" card appears at the bottom
- Tab switcher shows "Recent (ETF Proxy)" and "Long-Run (Simba)"
- Recent tab shows metric grid with columns Actual / Target (no Proposed yet)
- Long-Run tab shows CAGR, max drawdown, and the crisis stress table with 7 rows
- Annual returns heatmap appears with year rows, VTI column, and delta columns

Navigate to `http://localhost:3000/admin/allocation`, move a slider, then go back to `/audit`.

Verify:
- "Proposed Target" column now appears alongside Actual and Target

 - [x] **Step 7: Commit**

```bash
git add src/app/admin/allocation/page.tsx src/app/audit/page.tsx
git commit --no-gpg-sign -m "feat: wire ComparisonPanel — sessionStorage draft handoff, add to audit page"
```
