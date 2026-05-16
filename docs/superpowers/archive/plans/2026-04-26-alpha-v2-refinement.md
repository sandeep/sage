# Alpha v2 Performance Hardening & Filtering Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement date-based performance filtering (All Time, Yearly) for the Alpha Dashboard and refine "Benchmark Alpha" calculations to be more meaningful across all asset classes. Fix the persistent $0 Shadow VTI display.

**Architecture:** 
1. **Filtering:** Add `startDate` and `endDate` parameters to `calculateAlphaMetrics` and `getBookTradeStats`. Update the `/alpha` page to use a `?year=` query parameter.
2. **Benchmark Alpha Refinement:**
   - **Equities:** Confirmed (vs VTI share-equivalent).
   - **Options:** Refine Notional logic to ensure strike prices are captured; use dynamic risk-free rate for hurdle.
   - **Futures:** Remove "Benchmark Alpha" if no valid proxy exists, or use absolute return vs a specified notional margin hurdle.
3. **Data Integrity:** Ensure `reconstructShadowVti` is triggered during data loads or provided via a manual refresh.

**Tech Stack:** TypeScript, Next.js, better-sqlite3.

---

### Task 1: Date-Based Filtering in Metrics Engine

**Files:**
- Modify: `src/lib/logic/alpha/engine/metrics.ts`

- [ ] **Step 1: Update `calculateAlphaMetrics` signature**
Accept `startDate?: string` and `endDate?: string`. Update SQL queries to filter by date.

- [ ] **Step 2: Update `getBookTradeStats` signature**
Accept `startDate?: string` and `endDate?: string`. Ensure `close_date` (or `activity_date` for futures) falls within the range.

- [ ] **Step 3: Update `getAlphaNavSeries` signature**
Add date filtering to ensure the chart matches the selected period.

- [ ] **Step 4: Commit**
```bash
git add src/lib/logic/alpha/engine/metrics.ts
git commit -m "feat: add date-based filtering to alpha metrics engine"
```

---

### Task 2: Refine Benchmark Alpha Logic

**Files:**
- Modify: `src/lib/logic/alpha/engine/metrics.ts`

- [ ] **Step 1: Fix Options Benchmark Alpha**
Ensure `notional` is non-zero even if strike is missing (use a fallback like $100/share or 0.1x underlying price if available).

- [ ] **Step 2: Refine Futures Benchmark Alpha**
Instead of absolute P&L, label it as "Net P&L" or calculate alpha vs a cash hurdle (e.g. 5% on average daily margin).

- [ ] **Step 3: Commit**
```bash
git add src/lib/logic/alpha/engine/metrics.ts
git commit -m "feat: refine benchmark alpha calculations for options and futures"
```

---

### Task 3: UI Integration - Year Selector & Cleanup

**Files:**
- Modify: `src/app/alpha/page.tsx`
- Modify: `src/app/alpha/AlphaNavChart.tsx`

- [ ] **Step 1: Implement Year Selector**
Add a clean tab or dropdown UI to filter by "All Time", "2024", "2025", etc. Use Next.js `useSearchParams` or similar.

- [ ] **Step 2: Pass filters to Engine**
Call metrics functions with the derived date range.

- [ ] **Step 3: UI Cleanup**
Ensure "Shadow VTI Value" is bold and clearly separated if it's still causing confusion.

- [ ] **Step 4: Commit**
```bash
git add src/app/alpha/page.tsx src/app/alpha/AlphaNavChart.tsx
git commit -m "ui: implement year-based filtering and dashboard refinements"
```

---

### Task 4: Fix Shadow VTI Persistence

**Files:**
- Modify: `src/lib/logic/alpha/engine/shadowPortfolio.ts`
- Modify: `src/lib/ingest/index.ts` (or wherever ingestion triggers)

- [ ] **Step 1: Ensure reconstruction on ingest**
Hook `reconstructShadowVti` into the main ingestion flow to ensure the table is never empty.

- [ ] **Step 2: Commit**
```bash
git add src/lib/logic/alpha/engine/shadowPortfolio.ts
git commit -m "fix: ensure shadow vti is reconstructed on data ingestion"
```
