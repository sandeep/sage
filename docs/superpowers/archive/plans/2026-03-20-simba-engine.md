# Simba Historical Proxy Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Build a historical backtesting engine using Simba annual returns data with support for ticker mapping, redistribution, and cash proxies.

**Architecture:** A pure logic module that maps portfolio weights to Simba asset classes, calculates weighted annual returns, and computes annualized performance metrics (Nominal Return, Volatility, Sharpe, M2).

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Scaffolding and Data Loading

**Files:**
- Create: `src/lib/logic/simbaEngine.ts`

 - [x] **Step 1: Define Types and Mapping**

```typescript
export interface SimbaResult {
    annualizedReturn: number;
    volatility: number;
    sharpe: number;
    m2: number;
    coveragePct: number;
    annualReturns: number[];
}

export const TICKER_TO_SIMBA: Record<string, string> = {
    "VTI": "TSM", "VTSAX": "TSM", "ITOT": "TSM",
    "VOO": "LCB", "SPY": "LCB", "IVV": "LCB", "VFIAX": "LCB",
    "VBR": "SCV", "VIOV": "SCV",
    "VNQ": "REIT", "VGSLX": "REIT",
    "VXUS": "INTL", "VEA": "INTL", "VTMGX": "INTL",
    "VWO": "EM", "VEMAX": "EM",
    "BND": "ITT", "AGG": "ITT", "VBTLX": "ITT",
    "CASH": "Cash", "BIL": "Cash", "SHV": "Cash"
};
```

 - [x] **Step 2: Implement `calculateHistoricalProxyReturns` Skeleton**
Load `simba_returns.json` and prepare for calculations.

 - [x] **Step 3: Commit**
`git add src/lib/logic/simbaEngine.ts && git commit -m "chore: scaffold simbaEngine.ts"`

### Task 2: Core Logic Implementation

**Files:**
- Modify: `src/lib/logic/simbaEngine.ts`

 - [x] **Step 1: Implement Weight Redistribution**
Exclude unmapped tickers and redistribute weights. Calculate `coveragePct`.

 - [x] **Step 2: Implement Weighted Return Calculation**
For each year in the horizon, calculate the weighted sum of returns. Use 5% for 'Cash' and 0% vol.

 - [x] **Step 3: Implement Annualized Metrics**
Calculate CAGR, Volatility (Std Dev), Sharpe, and M2.

 - [x] **Step 4: Commit**
`git add src/lib/logic/simbaEngine.ts && git commit -m "feat: implement simbaEngine core logic"`

### Task 3: Verification with Tests

**Files:**
- Create: `src/lib/logic/__tests__/simbaEngine.test.ts`

 - [x] **Step 1: Write TSM matching test**
Verify 100% TSM for 5Y (2019-2023) matches raw data.

 - [x] **Step 2: Write Cash proxy test**
Verify 100% Cash has 5% return and 0% volatility.

 - [x] **Step 3: Write Redistribution test**
Verify unmapped tickers are ignored and weights redistributed.

 - [x] **Step 4: Run tests**
`npx vitest src/lib/logic/__tests__/simbaEngine.test.ts`

 - [x] **Step 5: Commit**
`git add src/lib/logic/__tests__/simbaEngine.test.ts && git commit -m "test: add simbaEngine tests"`
