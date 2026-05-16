# Per-Book Cashflow and MWR Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement per-book (Equities, Options, Futures) MWR/IRR calculations and address Task 0 review feedback.

**Architecture:** Extend the existing metrics engine to handle cashflow-based MWR per asset class. Update UI to be more resilient and dynamic.

**Tech Stack:** Next.js, Recharts, SQLite (via Better-SQLite3), Vitest.

---

### Task 1: Address Task 0 Review Feedback

**Files:**
- Modify: `src/app/alpha/page.tsx`
- Modify: `src/app/alpha/AlphaNavChart.tsx`

- [ ] **Step 1: Fix chart data alignment in page.tsx**
  Update `chartData` mapping to use `shadowVtiSeries[0]?.value` and `vtiNavSeries[0]?.nav` as fallbacks.
- [ ] **Step 2: Update CustomTooltip in AlphaNavChart.tsx**
  Make it dynamic and remove hardcoded indices.
- [ ] **Step 3: Update Sharpe/Alpha tooltips in page.tsx**
  Remove static percentages from content strings.
- [ ] **Step 4: Commit UI Fixes**
  `git commit -m "fix: address Task 0 review feedback for UI and chart alignment"`

### Task 2: Implement MWR Engine and Per-Book Metrics

**Files:**
- Modify: `src/lib/logic/alpha/engine/metrics.ts`

- [ ] **Step 1: Update BookTradeStats interface**
  Add `mwr`, `sharpeRatio`, and `calmarRatio`.
- [ ] **Step 2: Update getBookTradeStats for Options**
  Calculate MWR using premiums as cashflows and P&L for final value.
- [ ] **Step 3: Update getBookTradeStats for Equities**
  Calculate MWR using `open_price * qty` as negative cashflows and `close_price * qty` as positive.
- [ ] **Step 4: Update getBookTradeStats for Futures**
  Calculate absolute return metrics.
- [ ] **Step 5: Calculate Sharpe and Calmar per book**
  Implement these based on the trades' P&L and holding periods.

### Task 3: TDD - Verification

**Files:**
- Modify: `src/lib/logic/alpha/engine/__tests__/metrics.test.ts`

- [ ] **Step 1: Add per-book MWR test case**
  Mock trades for Equities and Options and verify MWR calculations.
- [ ] **Step 2: Run tests**
  `npm test src/lib/logic/alpha/engine/__tests__/metrics.test.ts`
- [ ] **Step 3: Commit Engine Changes**
  `git commit -m "feat: implement bulletproof per-book MWR and risk metrics"`

