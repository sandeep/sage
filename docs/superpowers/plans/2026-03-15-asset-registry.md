# Asset Registry & Live Data Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Replace static JSON data files with a live SQLite-backed asset registry, fetch all prices/metadata from Yahoo Finance, and expose no-data warnings throughout the UI.

**Architecture:** Three new DB tables (`asset_registry`, `price_history`, `ticker_meta`) replace `ticker_map.json`, `prices.json`, and `ticker_meta.json`. A `refresh.ts` module fetches live data from Yahoo Finance and is triggered at server startup (with a 4-hour staleness guard) and via a manual API route. All logic files (`xray.ts`, `rebalancer.ts`, `efficiency.ts`) are migrated from JSON imports to DB queries.

**Tech Stack:** Next.js 15, better-sqlite3, Yahoo Finance public API (`query1.finance.yahoo.com`), vitest for tests.

**Parallelization note:** This plan is independent. Plans B (Holdings UI) and C (CSV/Sankey) can run concurrently. Plan B's account nickname feature requires the `ALTER TABLE accounts ADD COLUMN nickname` migration — this plan owns that migration so Plan B should be started after Task 1 of this plan completes.

---

## Chunk 1: Schema & Migration

### Task 1: Add new tables and fix schema drift

**Files:**
- Modify: `src/lib/db/schema.sql`
- Create: `src/lib/db/migrate.ts`

- [x] **Step 1: Add new tables to schema.sql**
- [x] **Step 2: Create migrate.ts for additive column changes**
- [x] **Step 3: Call migrations in DB client**
- [x] **Step 4: Verify the app starts without errors**
- [x] **Step 5: Commit**

---

## Chunk 2: Seed Registry

### Task 2: Seed asset_registry from Bogleheads reference data

**Files:**
- Create: `src/lib/db/seed_registry.ts`

- [x] **Step 1: Create seed_registry.ts with full ticker data**
- [x] **Step 2: Run the seed**
- [x] **Step 3: Verify data is in DB**
- [x] **Step 4: Call seedRegistry from DB client on startup**
- [x] **Step 5: Commit**

---

## Chunk 3: Yahoo Finance Refresh

### Task 3: Implement refresh.ts

**Files:**
- Create: `src/lib/data/refresh.ts`

- [x] **Step 1: Create refresh.ts**
- [x] **Step 2: Verify the file compiles**
- [x] **Step 3: Commit**

### Task 4: Create /api/refresh route and instrumentation

**Files:**
- Create: `src/app/api/refresh/route.ts`
- Create or modify: `src/instrumentation.ts`
- Modify: `next.config.ts` (or `next.config.js`)

- [x] **Step 1: Create the API route**
- [x] **Step 2: Create instrumentation.ts**
- [x] **Step 3: Enable instrumentationHook in next.config**
- [x] **Step 4: Commit**

---

## Chunk 4: Migrate Logic Files

### Task 5: Add getLatestPrice helper and migrate xray.ts

**Files:**
- Create: `src/lib/db/prices.ts` (helper)
- Modify: `src/lib/logic/xray.ts`
- Modify: `src/lib/logic/__tests__/xray.test.ts`

- [x] **Step 1: Write failing tests for xray with DB-backed prices**
- [x] **Step 2: Run tests — verify they fail**
- [x] **Step 3: Create getLatestPrice helper**
- [x] **Step 4: Rewrite xray.ts to use DB**
- [x] **Step 5: Run tests**
- [x] **Step 6: Commit**

### Task 6: Migrate rebalancer.ts and efficiency.ts

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`
- Modify: `src/lib/logic/efficiency.ts`
- Modify: `src/lib/logic/__tests__/efficiency.test.ts`

- [x] **Step 1: Update failing test for efficiency — expect DB-backed meta**
- [x] **Step 2: Run test — verify it fails**
- [x] **Step 3: Rewrite efficiency.ts**
- [x] **Step 4: Rewrite rebalancer.ts price lookup**
- [x] **Step 5: Run all logic tests**
- [x] **Step 6: Commit**

---

## Chunk 5: No-Data Visibility + Allocation Editor

### Task 7: No-data warning strip on dashboard

**Files:**
- Modify: `src/app/page.tsx`

- [x] **Step 1: Add unpricedCount query to page.tsx**
- [x] **Step 2: Render warning strip in JSX**
- [x] **Step 3: Verify dashboard renders with/without warnings**
- [x] **Step 4: Commit**

### Task 8: Allocation weight editor

**Files:**
- Create: `src/app/admin/allocation/page.tsx`
- Create: `src/app/api/admin/allocation/route.ts`

- [x] **Step 1: Create the API route**
- [x] **Step 2: Create the editor page**
- [x] **Step 3: Add link to allocation editor in dashboard header**
- [x] **Step 4: Test the editor loads and saves**
- [x] **Step 5: Commit**

---

## Chunk 6: Cleanup

### Task 9: Archive and delete JSON files

**Do this ONLY after at least one successful runRefresh() has completed and data is visible in the dashboard.**

- [x] **Step 1: Archive old JSON files**
- [x] **Step 2: Delete the JSON files and fetch_meta.ts**
- [x] **Step 3: Verify build passes**
- [x] **Step 4: Final commit**
