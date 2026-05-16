# Performance Truth Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Transform the Audit page into a high-density "Decision Engine" with institutional-grade risk/reward metrics (M2, Alpha, Beta, Capture) across 1Y, 3Y, and 5Y horizons.

**Architecture:** 
1.  **Logic Layer:** Expand `performanceMetrics.ts` with pure math helpers; update `portfolioEngine.ts`.
2.  **Component Layer:** Build a high-density `PerformanceGrid` component with tooltips.
3.  **Page Layer:** Integrate the new engine and component into the `/audit` page.

**Tech Stack:** Next.js 15, TypeScript, SQLite, Tailwind CSS.

---

### Task 1: Institutional Math Helpers (Core Logic)

**Files:**
- Modify: `src/lib/logic/performanceMetrics.ts`
- Modify: `src/lib/logic/portfolioEngine.ts`
- Create: `src/lib/logic/__tests__/performance_metrics.test.ts`

 - [x] **Step 1: Define Global RF constant.** 
    - Export `ANNUAL_RF = 0.05` in `performanceMetrics.ts`.
 - [x] **Step 2: Implement institutional math in `performanceMetrics.ts`.**
    - `calculateM2(portfolioSharpe, benchmarkVol)`
    - `calculateAlpha(portReturn, benchReturn, beta)`
    - `calculateCaptureRatios(portReturns, benchReturns)`
 - [x] **Step 3: Update `portfolioEngine.ts`.**
    - Integrate these helpers into `calculatePortfolioPerformance()`.
 - [x] **Step 4: Verify against Audit Ground Truth.**
    - Write a test in `performance_metrics.test.ts` asserting that 1Y Live Data matches the audit note: 6.85% Return, 16.00% Vol, 0.1046 Sharpe, 6.95% M2.
 - [x] **Step 5: Commit.**

### Task 2: Simba Historical Proxy Engine

**Files:**
- Create: `src/lib/logic/simbaEngine.ts`
- Test: `src/lib/logic/__tests__/simbaEngine.test.ts`

 - [x] **Step 1: Implement `calculateHistoricalProxyReturns(weights, horizonYears)`.**
    - Map weights to `simba_returns.json` classes.
    - Handle Cash proxy (flat 5% return, 0% vol).
    - Return annualized Return, Vol, Sharpe, and M2.
 - [x] **Step 2: Implement unmapped ticker redistribution logic.**
 - [x] **Step 3: Surface "Data Coverage" metric.**
 - [x] **Step 4: Commit.**

### Task 3: PerformanceGrid Component (The Truth Grid)

**Files:**
- Create: `src/app/components/PerformanceGrid.tsx`

 - [x] **Step 1: Build the grid layout as per v5 visual spec.**
 - [x] **Step 2: Implement On-Hover Tooltips for all professional terms.**
 - [x] **Step 3: Commit.**

### Task 4: Audit Page Integration

**Files:**
- Modify: `src/app/audit/page.tsx`

 - [x] **Step 1: Pre-calculate 1Y, 3Y, and 5Y metrics using the new engines.**
 - [x] **Step 2: Replace the old RiskAdjustedPanel with the new `PerformanceGrid`.**
 - [x] **Step 3: Update `CostOfInactionHero` to lead with the 5Y Strategy Leakage amount.**
 - [x] **Step 4: Commit.**

---

### Phase 4: Final Verification

 - [x] **Step 1: Run all tests.**
 - [x] **Step 2: Build verification.**
 - [x] **Step 3: Commit final implementation.**
