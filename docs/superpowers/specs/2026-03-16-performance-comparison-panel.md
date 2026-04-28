# Spec: Performance Comparison Panel

**Date:** 2026-03-16
**Status:** Approved for implementation

---

## Goal

Add a policy benchmark comparison section to the `/audit` page that shows how the actual portfolio, the current saved target allocation, and a proposed (draft) target allocation compare against each other and against VTI as the market benchmark. Two data layers: recent ETF-proxy simulation and long-run Simba historical data.

---

## Location

New `'use client'` component `ComparisonPanel` added to `src/app/audit/page.tsx` as a child. The rest of the audit page remains a Server Component. `ComparisonPanel` owns all state, sessionStorage reads, and API fetches for this section.

---

## Draft Allocation Handoff

When the user edits sliders in the allocation explorer, the page writes the **flattened leaf-weight map** to `sessionStorage` under key `sage_draft_allocation` on every change. The audit page's `ComparisonPanel` reads this on mount.

**Flattened leaf-weight map format** — a `Record<string, number>` of leaf label → absolute portfolio weight, extracted from the nested draft tree:

```ts
// written by src/app/admin/allocation/page.tsx on every handleSliderChange / handleTopLevelSliderChange
function flattenLeafWeights(tree: Record<string, any>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [topKey, topNode] of Object.entries(tree)) {
        for (const [catLabel, catNode] of Object.entries(topNode.categories ?? {})) {
            if ((catNode as any).subcategories) {
                for (const [subLabel, subNode] of Object.entries((catNode as any).subcategories)) {
                    out[subLabel] = (subNode as any).weight ?? 0;
                }
            } else {
                out[catLabel] = (catNode as any).weight ?? 0;
            }
        }
        // Cash — top-level leaf with no categories; use the tree key (e.g. 'Cash'), not topNode.label
        if (!topNode.categories) out[topKey] = topNode.weight ?? 0;
    }
    return out;
}
sessionStorage.setItem('sage_draft_allocation', JSON.stringify(flattenLeafWeights(draftTree)));
```

`ComparisonPanel` reads `sessionStorage.getItem('sage_draft_allocation')` on mount. If the value is null or the parsed object is identical to the saved target allocation's flat weights, the Proposed column is hidden.

---

## Layout

### ComparisonPanel structure

```
[Tab switcher: RECENT (ETF proxy) | LONG-RUN (Simba)]
[Window selector (Recent only): 1Y | 3Y | 5Y]
[Metric grid: 3 columns — Actual | Target | Proposed*]
[Calendar year heatmap]
[Crisis stress table (Long-Run tab only)]
```
*Proposed column hidden if no draft in sessionStorage.

### Metric grid

Three columns: **Actual Portfolio** (emerald) | **Current Target** (indigo) | **Proposed Target** (amber).

**Recent tab metrics (per column):**

| Metric | Notes |
|--------|-------|
| Annualized Return | CAGR over selected window (1Y/3Y/5Y) |
| Sharpe Ratio | See annualization rules below |
| Sortino Ratio | Downside deviation only |
| Max Drawdown | Peak-to-trough on cumulative NAV |
| Volatility | Annualized std dev |
| Tracking Error vs VTI | Annualized std dev of excess returns |
| Information Ratio vs VTI | Annualized excess return / tracking error |
| Upside Capture vs VTI | Portfolio geo return / VTI geo return in months VTI > 0 |
| Downside Capture vs VTI | Portfolio geo return / VTI geo return in months VTI < 0 |

**Long-Run tab metrics (per column):**

| Metric | Notes |
|--------|-------|
| CAGR | Over full available Simba history |
| Sharpe Ratio | Annual data, annualizationFactor=1 |
| Max Drawdown | Peak-to-trough on cumulative NAV (reconstructed from annual returns) |
| Tracking Error vs VTI | Annual data, annualizationFactor=1 |
| Information Ratio vs VTI | Annual data |

Upside/Downside Capture **not shown** on Long-Run tab (annual frequency makes it unreliable). The API returns `null` for these fields on `tab=longrun`.

### Calendar year heatmap

Columns: `Year | VTI | Actual Δ | Target Δ | Proposed Δ`

- **VTI column**: actual annual return. Cell background: green (positive) or red (negative), opacity = `min(|return| / 0.40, 1.0) * 0.75` (so ±40% = opacity 0.75, ±20% = opacity 0.375).
- **Delta columns**: delta vs VTI only (e.g. `+2.6%` or `−1.8%`). Green = beat VTI, red = lagged. Same opacity formula applied to the delta magnitude.
- Single line per cell. `font-family: monospace`, `font-size: 12px`, `font-weight: 700`.
- An in-progress year (current calendar year) is included only if the window contains at least 6 months of data; otherwise excluded.

**Annual return derivation (Recent tab):** For each calendar year, compute `(nav[last_trading_day_of_year] / nav[first_trading_day_of_year]) - 1` using the reconstructed daily NAV.

**Annual return derivation (Long-Run tab):** Use Simba annual return values directly.

### Crisis stress table (Long-Run tab only)

| Crisis | Period | VTI | Actual Δ | Target Δ | Proposed Δ |
|--------|--------|-----|----------|----------|------------|
| Great Depression | 1929–1932 | | | | |
| WWII Bear | 1937 | | | | |
| Oil Crisis | 1973–1974 | | | | |
| Black Monday | 1987 | | | | |
| Dot-com | 2000–2002 | | | | |
| GFC | 2008–2009 | | | | |
| COVID Crash | 2020 | | | | |

Multi-year crisis returns are **compounded**: `(1+r_y1) * (1+r_y2) * ... - 1`. Delta shown inline: `−30.2% (8.7% > VTI)`.

---

## Data Architecture

### Recent tab — ETF proxy simulation

**Category → ETF proxy mapping** (hardcoded in `src/lib/logic/allocationSimulator.ts`):

| Allocation label | Proxy ETF |
|-----------------|-----------|
| Total Stock Market | VTI |
| US Large Cap / SP500 | VOO |
| Small Cap Value | VBR |
| REIT | VNQ |
| Mid-Cap | VO |
| Small-Cap | VB |
| Developed Market | VEA |
| Emerging Market | VWO |
| US Aggregate Bond | BND |
| ex-US Aggregate Bond | BNDX |
| Healthcare | — (excluded) |
| Energy | — (excluded) |
| Non Big (Ext Market) | — (excluded) |

**Weight redistribution for excluded categories:** After excluding unmapped leaves, redistribute their weights proportionally across **all** remaining mapped leaves globally (not within the same parent group):

```ts
const totalMapped = mappedLeaves.reduce((s, l) => s + weights[l], 0);
const scale = 1 / totalMapped; // rescale so mapped leaves sum to 1
const adjustedWeights = Object.fromEntries(mappedLeaves.map(l => [l, weights[l] * scale]));
```

A note is shown in the UI: `"Excludes {n} sector funds ({X.X}% of allocation) — weights redistributed."`

If `totalMapped === 0` (no leaves can be mapped), the simulation returns an error and the Recent tab shows "Insufficient data."

**Simulation algorithm** (`simulateAllocationNAV`):
1. Fetch daily closing prices for all proxy ETFs from `price_history`.
2. Intersect dates across all ETF series and the selected window.
3. Set NAV[0] = 1.0. For each subsequent date: `NAV[t] = Σ(adjustedWeight_i × price_i[t] / price_i[0])`. This is a **constant-weight daily-rebalanced** simulation — it implicitly rebalances back to the initial weights each day, which slightly overstates diversification benefit relative to a real portfolio that rebalances less frequently. This assumption should be noted in the UI.
4. Compute daily log-returns from NAV series.
5. Return `{ dates, nav, dailyReturns }`.

Minimum data requirement: 60 trading days. If fewer, return `null` for that portfolio.

For **Actual Portfolio**: use existing `portfolioEngine.ts` NAV reconstruction.
For **VTI benchmark**: use VTI price history directly.

### Long-Run tab — Simba static data

**File:** `src/lib/data/simba_returns.json`

Structure:
```json
{
  "source": "Simba Backtesting Spreadsheet",
  "updated": "2026-03-16",
  "asset_classes": {
    "TSM":  { "label": "Total Stock Market",   "returns": { "1928": 0.438, "1929": -0.086 } },
    "LCB":  { "label": "US Large Cap / SP500", "returns": { "1928": 0.438, ... } },
    "SCV":  { "label": "Small Cap Value",      "returns": { "1928": 0.232, ... } },
    "REIT": { "label": "REIT",                 "returns": { "1972": 0.082, ... } },
    "INTL": { "label": "Developed Market",     "returns": { "1970": 0.049, ... } },
    "EM":   { "label": "Emerging Market",      "returns": { "1988": 0.554, ... } },
    "ITT":  { "label": "US Aggregate Bond",    "returns": { "1928": 0.037, ... } },
    "VTI":  { "label": "VTI Benchmark",        "returns": { "1928": 0.438, ... } }
  }
}
```

**Simba label → allocation category mapping:**
```ts
const SIMBA_MAP: Record<string, string> = {
  'Total Stock Market':   'TSM',
  'US Large Cap / SP500': 'LCB',
  'Small Cap Value':      'SCV',
  'REIT':                 'REIT',
  'Developed Market':     'INTL',
  'Emerging Market':      'EM',
  'US Aggregate Bond':    'ITT',
  // Mid-Cap, Small-Cap, ex-US Aggregate Bond, Healthcare, Energy, Non Big → excluded
};
```

All categories not in `SIMBA_MAP` are excluded (Mid-Cap, Small-Cap, ex-US Aggregate Bond, Healthcare, Energy, Non Big). The same proportional weight redistribution algorithm as the Recent tab applies.

**Simulation algorithm** (`simulateSimbaAllocation`):
1. For each mapped leaf, look up its Simba annual return series.
2. Find the intersection of years across all mapped leaves.
3. Apply weight redistribution (same algorithm as Recent tab).
4. For each year: `portfolioReturn[y] = Σ(adjustedWeight_i × simbaReturn_i[y])`.
5. Return `{ years, annualReturns }`.

Minimum data: 10 years of common coverage. If fewer, return `null`.

---

## Annualization Rules

All metric functions accept an `annualizationFactor: number` parameter:

| Tab | Data frequency | annualizationFactor | Risk-free rate per period |
|-----|----------------|--------------------|--------------------------|
| Recent | Daily | 252 | 0.05 / 252 |
| Long-Run | Annual | 1 | 0.05 |

Functions scale by `sqrt(annualizationFactor)` where needed (volatility, Sharpe, Sortino, tracking error, information ratio).

---

## Max Drawdown — NAV Reconstruction

For **Recent tab**: drawdown is computed directly on the reconstructed daily NAV array.

For **Long-Run tab**: `simulateSimbaAllocation` returns annual returns. Before computing drawdown, reconstruct a cumulative NAV:
```ts
const nav = [1.0];
for (const r of annualReturns) nav.push(nav[nav.length - 1] * (1 + r));
```
Then compute peak-to-trough on this NAV array. `computeMaxDrawdown` always receives a NAV array (not a returns array).

---

## New API Route

`GET /api/performance/comparison`

Query params:
- `tab`: `recent` | `longrun` (default: `recent`)
- `window`: `1y` | `3y` | `5y` (Recent tab only, default: `3y`)
- `draft`: base64url-encoded JSON string of `Record<string, number>` flat leaf weights (optional)

Response shape:

```ts
interface PortfolioMetrics {
  annualizedReturn: number | null;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number | null;         // negative decimal, e.g. -0.38
  volatility: number | null;
  trackingErrorVsVti: number | null;
  informationRatioVsVti: number | null;
  upsideCaptureVsVti: number | null;  // null on longrun tab
  downsideCaptureVsVti: number | null; // null on longrun tab
  annualReturns: Record<string, number>; // year string → return decimal
}

interface ComparisonResponse {
  actual: PortfolioMetrics | null;
  target: PortfolioMetrics | null;
  proposed: PortfolioMetrics | null;   // null if no draft provided
  vti: {
    annualReturns: Record<string, number>;
    annualizedReturn: number | null;
    maxDrawdown: number | null;
  };
  excluded: string[];             // category labels excluded from simulation
  excludedWeight: number;         // sum of excluded weights (before redistribution)
  tab: 'recent' | 'longrun';
  window: '1y' | '3y' | '5y';
  dataNote: string | null;        // e.g. "Excludes 3 sector funds (7.2% of allocation)"
}
```

Error cases:
- If actual portfolio has < 60 trading days of price history: `actual: null`.
- If VTI has insufficient history for the requested window: return 400 with `{ error: "VTI price history insufficient for {window} window" }`.
- If draft is provided but malformed: ignore draft, return `proposed: null`.

---

## New Computations (`src/lib/logic/performanceMetrics.ts`)

```ts
// All return arrays are either daily log-returns or annual simple returns depending on tab.
// annualizationFactor: 252 for daily, 1 for annual.

function computeMaxDrawdown(nav: number[]): number
// nav is cumulative NAV array starting at 1.0.
// Returns peak-to-trough: min over all t of (nav[t] - max(nav[0..t])) / max(nav[0..t]).
// Always negative or zero.

function computeTrackingError(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  annualizationFactor: number
): number
// Annualized std dev of (portfolio - benchmark) for aligned return pairs.

function computeInformationRatio(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  annualizationFactor: number
): number
// (mean excess return * annualizationFactor) / trackingError.

function computeUpsideCapture(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): number
// Geometric mean of portfolio returns in periods where benchmarkReturn > 0,
// divided by geometric mean of benchmark returns in those same periods.

function computeDownsideCapture(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): number
// Same but for periods where benchmarkReturn < 0.
```

These complement the existing `calculateSharpeRatio`, `calculateSortinoRatio`, `calculateCorrelation` in `src/lib/logic/alpha.ts`. All existing functions are reused unchanged; new functions follow the same signature patterns.

---

## New Simulation Module (`src/lib/logic/allocationSimulator.ts`)

```ts
function simulateAllocationNAV(
  weights: Record<string, number>,
  priceHistory: Record<string, Record<string, number>>,  // ticker → date → close
  startDate: string,
  endDate: string
): { dates: string[]; nav: number[]; dailyReturns: number[] } | null

function simulateSimbaAllocation(
  weights: Record<string, number>,
  simbaData: SimbaData,
  startYear?: number,
  endYear?: number
): { years: number[]; annualReturns: number[] } | null

const ETF_PROXY_MAP: Record<string, string>   // leaf label → ETF ticker
const SIMBA_MAP: Record<string, string>        // leaf label → Simba asset class key

function redistributeExcludedWeights(
  weights: Record<string, number>,
  mappedLabels: string[]
): { adjusted: Record<string, number>; excluded: string[]; excludedWeight: number }
```

---

## New Component (`src/app/components/CalendarHeatmap.tsx`)

```ts
interface CalendarHeatmapProps {
  years: number[];
  vti: Record<number, number>;            // year → return decimal
  actual: Record<number, number> | null;
  target: Record<number, number> | null;
  proposed: Record<number, number> | null;
}
```

Cell background opacity formula:
```ts
const opacity = Math.min(Math.abs(value) / 0.40, 1.0) * 0.75;
const bg = value >= 0
  ? `rgba(16,185,129,${opacity})`   // emerald
  : `rgba(239,68,68,${opacity})`;   // red
```

VTI column shows raw return. Delta columns show `(portfolio_return - vti_return)`, formatted as `+X.X%` or `−X.X%`.

---

## Files Modified / Created

| File | Change |
|------|--------|
| `src/lib/logic/performanceMetrics.ts` | Create — new metric computations |
| `src/lib/logic/allocationSimulator.ts` | Create — ETF proxy + Simba simulation + weight redistribution |
| `src/lib/data/simba_returns.json` | Create — one-time Simba data conversion |
| `src/app/api/performance/comparison/route.ts` | Create — new API route |
| `src/app/components/CalendarHeatmap.tsx` | Create — heatmap component |
| `src/app/components/ComparisonPanel.tsx` | Create — `'use client'` wrapper; owns sessionStorage read, tab state, API fetch |
| `src/app/admin/allocation/page.tsx` | Modify — write flattened draft to `sessionStorage` on every slider change |
| `src/app/audit/page.tsx` | Modify — import and render `<ComparisonPanel />` at bottom |

---

## What Does NOT Change

- Existing audit page metrics (Sharpe, Sortino, 1Y return, vol, beta, correlation, efficiency, allocation %)
- `portfolioEngine.ts` — used as-is for actual portfolio NAV
- `/api/admin/allocation` data layer
- DB schema — no new tables

---

## Out of Scope

- Alpha sleeve performance (separate sub-project)
- Tax-aware rebalancer (separate sub-project)
- Monte Carlo simulation
- Factor analysis (Fama-French)
- Upside/downside capture on Long-Run tab (annual data frequency; omitted from response)
