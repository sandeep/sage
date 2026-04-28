# PE&D Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Build the Portfolio Efficiency & Drag module to quantify leakage and provide agentic commentary using Finnhub, FMP, and Yahoo Finance APIs.

**Architecture:** Extend the Next.js engine with a dedicated `efficiency` logic layer and a "Strategic Discussion" UI component powered by local LLM summaries.

**Tech Stack:** Next.js, SQLite, Finnhub API, FMP API, Yahoo Finance (yfinance).

---

## Chunk 1: Advanced Data Ingestion

**Goal:** Fetch and store yields, expense ratios, and sentiment data.

### Task 1: Portfolio Meta-Data (Yahoo Finance)

**Files:**
- Create: `src/lib/data/ticker_meta.json`
- Modify: `src/lib/logic/efficiency.ts`

- [x] **Step 1: Implement script to fetch Dividend Yields and Expense Ratios.** (Implemented in `refresh.ts` and `ticker_meta` DB table)
- [x] **Step 2: Store in `ticker_meta.json`.** (Stored in SQLite `ticker_meta` table)
- [x] **Step 3: Commit.**

---

## Chunk 2: Efficiency & Drag Logic

**Goal:** Calculate the literal cost of the current portfolio structure.

### Task 2: Tax Drag Calculation

**Files:**
- Create: `src/lib/logic/efficiency.ts`
- Test: `src/lib/logic/__tests__/efficiency.test.ts`

- [x] **Step 1: Implement `calculateTaxDrag` logic.** (Yield * TaxRate * HoldingValue).
- [x] **Step 2: Verify drag rollup in tests.**
- [x] **Step 3: Commit.**

---

## Chunk 3: Agentic Commentary UI

**Goal:** Add the "Strategic Discussion" visual cards.

### Task 3: Commentary Dashboard

**Files:**
- Create: `src/app/components/StrategicDiscussion.tsx`
- Modify: `src/app/page.tsx`

- [x] **Step 1: Build the "Strategic Discussion" card.**
- [x] **Step 2: Integrate Finnhub Sentiment API.** (Note: using local logic/placeholders for sentiment until API keys added)
- [x] **Step 3: Add "Efficiency" metrics to the main dashboard.**
- [x] **Step 4: Commit.**
