# Implementation Plan: Data Veracity Hardening (Phase 4.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate sloppy shortcuts, mathematical errors, and silent fallbacks in the data ingestion and performance calculation pipelines to ensure absolute trust in the system's output.

**Architecture:** 
1.  **Mathematical Fixes**: Correct VTIVX weights, implement Sample Standard Deviation, and add validation guards.
2.  **Temporal Integrity**: Fix hardcoded dates and ensure historical price resolution uses the correct date.
3.  **Ingestion Rigor**: Remove silent fallbacks to "Total Stock Market" and enforce explicit mapping.

**Tech Stack:** TypeScript, SQLite, Next.js.

---

### Task 1: Mathematical & Statistical Integrity

**Files:**
- Modify: `src/lib/data/refresh.ts`
- Modify: `src/lib/logic/performanceMetrics.ts`

- [ ] **Step 1: Fix VTIVX Weights**
In `src/lib/data/refresh.ts` (or wherever the `seed_db` logic lives), correct the VTIVX composition. 
*(Hint: 54% Total Stock, 36% Total Intl Stock, 7% Total Bond, 3% Total Intl Bond = 100%)*

- [ ] **Step 2: Add Composition Validation**
In the ingestion flow, before inserting ETF composition into the DB, ensure the weights sum to 1.0 (with a small epsilon for rounding). If they don't, throw an error.

- [ ] **Step 3: Fix Standard Deviation Calculation**
In `src/lib/logic/performanceMetrics.ts`, update `computeTrackingError` (or relevant SD functions) to use `N-1` (Sample Standard Deviation) instead of `N` (Population) for variance calculations.

- [ ] **Step 4: Geometric Mean Safeguards**
In `src/lib/logic/performanceMetrics.ts`, ensure any geometric mean or CAGR calculation handles negative growth factors gracefully (e.g., clipping or throwing an explicit error rather than returning `NaN`).

---

### Task 2: Temporal Integrity & Price Resolution

**Files:**
- Modify: `src/lib/logic/referenceDates.ts`
- Modify: `src/lib/logic/xray.ts`

- [ ] **Step 1: Remove Hardcoded Anchor**
In `src/lib/logic/referenceDates.ts`, change `TODAY_ANCHOR` from a hardcoded string to a dynamic `new Date().toISOString().split('T')[0]`, unless a specific "Simulation Date" is active.

- [ ] **Step 2: Fix Price Resolution**
In `src/lib/logic/xray.ts` (specifically `resolveValue` or similar functions), update the SQL queries. When asking for a historical value, query `price_history` for `date <= ? ORDER BY date DESC LIMIT 1` rather than just `MAX(date)`.

---

### Task 3: Ingestion Rigor & Proxy Mapping

**Files:**
- Modify: `src/lib/data/refresh.ts` (or ingest logic)
- Modify: `src/lib/logic/simbaEngine.ts`

- [ ] **Step 1: Remove Silent Fallbacks**
In `src/lib/data/refresh.ts` (`discoverAssets`), when a new ticker is found, DO NOT automatically insert it into `asset_registry` with `asset_class = 'Total Stock Market'`. Leave it unmapped (or set a specific 'UNMAPPED' status) so the dashboard alerts the user.

- [ ] **Step 2: Refine Simba Proxies**
In `src/lib/logic/simbaEngine.ts`, review `LABEL_TO_SIMBA`. Stop mapping complex sectors (like Healthcare) directly to `VTSMX`. Create a generic 'EQUITY_PROXY' or throw a 'Missing Proxy' error if a precise mapping isn't available.

---

### Task 4: Verification

- [ ] **Step 1: Run Full Test Suite**
Run `npm test`. Fix any tests that relied on the old (incorrect) math or hardcoded dates.

- [ ] **Step 2: Build Check**
Run `npm run build` to ensure type safety.
