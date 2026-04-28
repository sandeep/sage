# Performance Page Redesign
**Date:** 2026-03-18
**Status:** Approved
**Route:** `/audit`

---

## Purpose

Replace the current audit/performance page with a focused, actionable view that answers two questions a private wealth client asks every time they look at their portfolio:

1. **Am I overpaying?** (tax inefficiency + fund costs)
2. **What am I leaving on the table per year?** (allocation gap vs target)

The page should read like a Goldman morning brief — the dollar verdict first, the evidence below. Every metric has context. Nothing is shown without a benchmark anchor.

---

## What Gets Cut

| Component | Reason |
|---|---|
| `AlphaPerformance` (Sharpe/Sortino/Win Rate card) | Belongs to the active trading/directives workflow, not passive allocation |
| `MacroInsights` | Not actionable in this context |
| Efficiency Attribution mini-card | Absorbed into Zone 1 hero |
| Current/Target/Ideal metrics table | Replaced by Zone 2 performance strip |

The `ComparisonPanel` (NAV chart, heatmap, crisis stress tests) stays intact as Zone 4 — subordinated as supporting evidence, not removed.

---

## Page Structure

Four zones, top to bottom:

```
Zone 1 — The Verdict Hero       (annual cost of inaction in dollars)
Zone 2 — Risk-Adjusted Performance  (benchmark-relative scorecard)
Zone 3 — Cost Proof             (why you're paying what you're paying)
Zone 4 — Supporting Evidence    (existing ComparisonPanel, reframed)
```

---

## Zone 1: The Verdict Hero

**Purpose:** Answer "what is this costing me annually?" before anything else.

### Layout

Full-width dark card. Two rows:

**Row 1 — Headline number**
```
ESTIMATED ANNUAL DRAG
$4,820 / yr
tax placement · fund costs · allocation drift
```

**Row 2 — Three breakdown tiles**
```
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│ TAX LEAKAGE        │  │ FEE DRAG           │  │ ALLOCATION GAP     │
│  $1,240 / yr       │  │   $380 / yr        │  │  $3,200 / yr       │
│  62 bps            │  │   19 bps           │  │  +0.32% CAGR       │
│  3 moves fix it →  │  │  2 swaps fix it →  │  │  if on target      │
└────────────────────┘  └────────────────────┘  └────────────────────┘
```

Each tile is **clickable** — scrolls to its corresponding proof section in Zone 3.

### Data Sources

| Tile | Computation |
|---|---|
| Tax Leakage | `efficiency.locationDragBps / 10000 × portfolioValue` |
| Fee Drag | `efficiency.expenseDragBps / 10000 × portfolioValue` |
| Allocation Gap | `(targetExpectedCagr − currentExpectedCagr) × portfolioValue` |
| Total | Sum of all three |

BPS shown in small text below each dollar figure for analysts who prefer that unit.

### Severity Coloring

- `rose` border/accent: >$500/yr or >25 BPS
- `amber`: $200–500/yr or 10–25 BPS
- `emerald`: negligible (<$200/yr or <10 BPS)

### Privacy Mode

All dollar amounts replace with `•••` when privacy mode is active. BPS values remain visible.

---

## Zone 2: Risk-Adjusted Performance

**Purpose:** Answer "am I being compensated for the risk I'm taking?"

### Layout

Three sub-sections in order:

**1. Uncompensated Risk (leads the zone)**
```
UNCOMPENSATED RISK
Beta-adjusted expected return: 17.4%   Actual: 19.2%   +1.8% alpha ✓
You are being compensated for the extra risk you're taking vs VTI.
```
- If `actual > beta-adjusted expected`: emerald, affirming message
- If `actual < beta-adjusted expected`: rose, warning message
- Formula: `beta-adjusted expected = riskFreeRate + beta × (vtiReturn − riskFreeRate)`

**2. Verdict (plain English)**
```
VERDICT
You took 12% more risk than VTI and earned 3.1% more return.
On a Sharpe basis you're ahead. On Beta-adjusted return, neutral.
```
One or two sentences, computed from data. Generated server-side as a string.

**3. Comparison Table**

```
┌──────────────────┬─────────┬──────────┬───────────┬─────────┐
│                  │ CURRENT │ Δ TARGET │ Δ PROPOSED│  Δ VTI  │
├──────────────────┼─────────┼──────────┼───────────┼─────────┤
│  1Y RETURN       │  19.2%  │  −1.4%   │  −0.8%    │  +3.1%  │
│  VOLATILITY      │  13.4%  │  −1.3%   │  −1.6%    │  −1.5%  │
│  SHARPE          │   1.24  │  −0.06   │  +0.07    │  +0.31  │
│  SORTINO         │   1.87  │  −0.13   │  +0.05    │  +0.46  │
│  BETA            │   1.08  │  −0.06   │  −0.10    │  −0.08  │
│  MAX DRAWDOWN    │  −14.2% │  +1.1%   │  +1.8%    │  +1.4%  │
│  EXP CAGR  †     │   7.8%  │  +0.3%   │  +0.6%    │   —     │
└──────────────────┴─────────┴──────────┴───────────┴─────────┘
† Forward-looking estimate based on asset class premiums.
```

- **CURRENT** column: absolute values, always shown
- **Δ TARGET**: delta from current to target allocation simulation. Always shown.
- **Δ PROPOSED**: delta from current to draft allocation. Only shown when a draft allocation is loaded in `sessionStorage` (`sage_draft_allocation`). Column hidden otherwise.
- **Δ VTI**: delta from current to VTI. Always shown.

Delta sign convention: positive is always directionally better for that metric (higher return = positive, lower vol = positive delta displayed as negative number in green, etc). Color delta cells: emerald = improvement, rose = regression, zinc = negligible.

### Data Sources

- CURRENT: `calculatePortfolioPerformance()` → `portfolioEngine.ts`
- Δ TARGET: simulated via `simulateAllocationNAV()` using current `target_allocation.json`
- Δ PROPOSED: simulated via `simulateAllocationNAV()` using draft from `sessionStorage`
- Δ VTI: from `price_history` WHERE ticker = 'VTI'
- EXP CAGR: `calculatePortfolioExpectedCagr()` / `calculateTargetExpectedCagr()` from `xray.ts`

---

## Zone 3: Cost Proof

Two named subsections, each anchored by the corresponding Zone 1 tile click.

### 3a — Why You're Overpaying

**Tax Placement** sub-section:
- Table: each misplaced holding → current account type → recommended account type → estimated annual savings
- Savings = `locationDragBps` attributed per holding, converted to dollars
- Pulls from `taxPlacement.ts` PLACEMENT_PRIORITY rules

**Fund Costs** sub-section:
- Table: each holding → current ER → optimal ER available → estimated savings
- Pulls from `getExpenseRisks()` in `xray_risks.ts`
- Only shows holdings where a cheaper alternative exists

### 3b — What the Allocation Gap Is Costing You

```
Current expected CAGR:  7.8%   ████████████░░░  vs target 8.1%
Gap: 0.32% × $1.0M portfolio = $3,200 / yr left on the table

WHERE THE DRIFT IS:
┌──────────────────────────────────────────────────────────────┐
│ Small Cap Value    underweight  −3.2%   costs ~$890/yr       │
│ Intl Developed     underweight  −2.1%   costs ~$580/yr       │
│ US Total Market    overweight   +5.3%   drag   ~$1,730/yr    │
└──────────────────────────────────────────────────────────────┘
```

- Drift per asset class from `calculateHierarchicalMetrics()` Level 2 rows
- Per-category dollar attribution: proportional share of total allocation gap dollar amount, weighted by absolute drift magnitude
- Privacy mode: hides portfolio value and per-category dollar amounts

---

## Zone 4: Supporting Evidence

The existing `ComparisonPanel` component, unchanged functionally. Re-headed as "Supporting Evidence" instead of "Policy Benchmark Comparison". Tab structure (Recent / Long-Run) preserved.

Contains:
- NAV chart (your portfolio vs target vs VTI, trailing 1yr)
- Metric grid (annualized return, vol, Sharpe, max drawdown)
- Calendar year heatmap (annual returns vs VTI)
- Crisis stress table (Long-Run tab: 2008, COVID, dot-com)

---

## New Computations Required

These don't exist in the codebase today and must be added:

| Computation | Location | Formula |
|---|---|---|
| Tax drag in dollars | `efficiency.ts` or `audit/page.tsx` | `locationDragBps / 10000 × portfolioValue` |
| Fee drag in dollars | `efficiency.ts` or `audit/page.tsx` | `expenseDragBps / 10000 × portfolioValue` |
| Allocation gap in dollars | `audit/page.tsx` | `(targetCagr − currentCagr) × portfolioValue` |
| Per-category dollar attribution | `audit/page.tsx` | proportional attribution of gap by drift magnitude |
| Beta-adjusted expected return | `audit/page.tsx` | `rf + beta × (vtiReturn − rf)` |
| Verdict sentence | `audit/page.tsx` | server-side string from computed values |
| VTI trailing 1Y return | `portfolioEngine.ts` or `audit/page.tsx` | from `price_history` WHERE ticker = 'VTI' |
| Max drawdown | `portfolioEngine.ts` | max peak-to-trough from daily NAV series |

---

## Component Map

| Zone | New Component | Replaces |
|---|---|---|
| Zone 1 | `CostOfInactionHero` (server) | EfficiencyTile + Efficiency Attribution card |
| Zone 2 | `RiskAdjustedPanel` (server) | AlphaPerformance + metrics table |
| Zone 3a | `OverpayingProof` (server) | RiskWidget (partially) |
| Zone 3b | `AllocationGapProof` (server) | (new) |
| Zone 4 | `ComparisonPanel` (client, unchanged) | ComparisonPanel |

Page data fetching stays in `audit/page.tsx` as a React Server Component. All new components are server components receiving props — no additional client state needed beyond what `ComparisonPanel` already manages.

---

## Privacy Mode

Zone 1–3 are server components and cannot call `usePrivacy()` directly. Pattern: each server component accepts a `privacy: boolean` prop. A thin `'use client'` wrapper in `audit/page.tsx` reads `usePrivacy()` and passes it down as a prop. Dollar amounts render as `•••` when `privacy === true`. BPS values, percentages, and ratios remain visible regardless.

The Δ PROPOSED column in Zone 2 depends on `sessionStorage`, which is unavailable in RSCs. This follows the same pattern as `ComparisonPanel`: a client component reads `sessionStorage` on mount and passes the draft weights to the comparison API via a `?draft=` query param (base64-encoded JSON). `RiskAdjustedPanel` must therefore be a `'use client'` component that fetches its own simulation data, or receive draft weights via a client wrapper that injects them after hydration.

---

## Out of Scope

- Changes to the allocation editor or directives workflow
- Active trading / AlphaPerformance workflow (separate page)
- Mobile layout optimization
- Historical snapshots or time-travel (view portfolio as of a past date)
