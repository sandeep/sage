# Asset Registry & Live Data Design

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Phase A — Asset Registry DB, live price/meta fetch from Yahoo Finance, no-data visibility, target allocation weight editor

---

## Problem

The app currently stores ticker metadata and prices in static JSON files (`ticker_map.json`, `prices.json`, `ticker_meta.json`). These files are:

- **Incomplete** — only ~36 tickers mapped, ~111 prices, many with placeholder `1.00` values
- **Stale** — prices and metadata are not refreshed from live data
- **Silent** — when data is missing the app falls back to fake defaults (`1.00`, `0.015`) without indicating anything is wrong, making the dashboard unreliable

---

## Goals

1. Move all ticker metadata and pricing into SQLite (same DB as the rest of the app)
2. Fetch prices, yield, expense ratio, and 1-year returns live from Yahoo Finance
3. Store a full year of daily closing prices per ticker for return/volatility calculations
4. Surface any missing or unfetched data visibly — no silent defaults
5. Allow editing of target allocation weights (percentages only) via a UI
6. Seed the asset registry from the provided Bogleheads reference spreadsheet (~100 tickers)

---

## Out of Scope (this phase)

- Editing ticker metadata via UI (admin edit UI is a follow-on)
- Editing allocation hierarchy (add/remove categories, rename buckets)
- LLM-assisted enrichment of ticker data
- External scheduler / cron for price refresh

---

## Database Schema

### New table: `asset_registry`

Replaces `ticker_map.json`. One row per ticker.

```sql
CREATE TABLE asset_registry (
    ticker        TEXT PRIMARY KEY,
    canonical     TEXT NOT NULL,
    description   TEXT,
    asset_type    TEXT,
    weights       TEXT NOT NULL,  -- JSON: {"Total Stock Market": 1.0}
    is_core       INTEGER DEFAULT 0,
    index_tracked TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### New table: `price_history`

Replaces `prices.json`. One row per ticker per calendar day.

```sql
CREATE TABLE price_history (
    ticker TEXT NOT NULL,
    date   TEXT NOT NULL,  -- YYYY-MM-DD
    close  REAL NOT NULL,
    PRIMARY KEY (ticker, date)
);
```

### New table: `ticker_meta`

Replaces `ticker_meta.json`. All fields fetched live from Yahoo Finance. NULL means not available — never defaulted.

```sql
CREATE TABLE ticker_meta (
    ticker     TEXT PRIMARY KEY,
    yield      REAL,
    er         REAL,
    return1y   REAL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Unchanged

- `accounts`, `holdings`, `directives`, `performance_snapshots`, `etf_composition` — no changes
- `target_allocation.json` — kept as a writable JSON file (the only one)

---

## Data Fetch Layer

### Module: `src/lib/data/refresh.ts`

Replaces `fetch_meta.ts`. Reads all tickers from `asset_registry`, fetches live data from Yahoo Finance, writes to DB. Never writes to JSON files.

**Responsibilities:**

**1. Price history** (`fetchPriceHistory`)
- Endpoint: `GET https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=1y&interval=1d`
- Per ticker: checks `MAX(date)` in `price_history`; fetches only from that date forward (incremental after first run)
- Upserts new rows into `price_history`
- If Yahoo returns no data: logs the ticker as failed, inserts nothing

**2. Ticker meta** (`fetchTickerMeta`)
- Quote endpoint (batch): `GET /v7/finance/quote?symbols={ticker1,ticker2,...}` (batch ≤10)
  - Extracts: `regularMarketPrice` (current price, also inserted as today's `price_history` row), `trailingAnnualDividendYield`
  - Add a 500ms delay between batches to avoid Yahoo rate-limiting (429). On 429, skip remaining tickers in that run and include them in `failed[]`
- Summary endpoint (per ticker): `GET /v10/finance/quoteSummary/{ticker}?modules=defaultKeyStatistics`
  - Extracts: `annualReportExpenseRatio`
- **ER unit:** Yahoo returns `annualReportExpenseRatio` as a decimal (e.g. `0.0003` for a 0.03% fund). Store as-is (decimal). `efficiency.ts` currently divides `er` by 100 — that division must be removed during migration so it reads the raw decimal directly.
- Upserts into `ticker_meta`; any field Yahoo doesn't return is stored as NULL

**3. Orchestration** (`runRefresh`)
- Calls `fetchPriceHistory` then `fetchTickerMeta` for all tickers in `asset_registry`
- Returns a structured result: `{ updated: string[], failed: string[], missingMeta: string[] }`

### API Route: `POST /api/refresh`

- Calls `runRefresh()`
- Returns the result summary as JSON
- Called once at server startup via Next.js `instrumentation.ts`
- Also callable manually from the admin UI

### Staleness guard in `instrumentation.ts`

`instrumentation.ts` must not call `runRefresh()` on every dev hot-reload. Guard condition:

```ts
const lastFetch = db.prepare("SELECT MAX(fetched_at) as t FROM ticker_meta").get() as { t: string | null };
const staleThresholdHours = 4;
const isStale = !lastFetch.t || (Date.now() - new Date(lastFetch.t).getTime()) > staleThresholdHours * 3600 * 1000;
if (isStale) await runRefresh();
```

Also requires `instrumentationHook: true` in `next.config.ts`.

---

## No-Data Visibility Rules

All silent fallbacks are replaced with explicit indicators:

| Situation | Old behavior | New behavior |
|---|---|---|
| Ticker in holdings, not in `asset_registry` | Categorized as "Other" silently | Yellow "Unmapped" badge; counted separately in xray |
| Ticker has no rows in `price_history` | Falls back to `prices.json` value of `1.00` | Value shown as `—`; excluded from portfolio total; warning banner on dashboard |
| `ticker_meta` yield/ER is NULL | Uses hardcoded default (0.015, 0.05) | Shown as `N/A` in efficiency attribution |
| Category has mapped tickers but none held | Shows 0% actual silently | No change — 0% is valid |
| Any holdings are unpriced or unmapped | Nothing | Persistent warning strip at top of dashboard: "X holdings missing price data" |

### Implementation notes

- `xray.ts` stops importing JSON files; reads `asset_registry` and `price_history` from DB
- Helper `getLatestPrice(ticker)`: `SELECT close FROM price_history WHERE ticker = ? ORDER BY date DESC LIMIT 1` — returns `null` if no rows
- **Price precedence rule:** `market_value` from the `holdings` table (ingested from CSV upload) takes priority over `price_history`. The fallback chain is: `holdings.market_value` (if > 0) → `price_history` latest close → `null`. This matches the existing behavior in `xray.ts` and `page.tsx`.
- Any component receiving `null` price renders `—` and excludes from totals
- Dashboard warning strip is server-rendered; count computed at page load
- The `/holdings` page follows the same null rendering rules — `—` for unpriced tickers

---

## Target Allocation Weight Editor

### Page: `/admin/allocation`

- Lists all top-level and nested categories from `target_allocation.json`
- Each row shows: category label, current target weight (%), inline number input
- Weights are grouped by parent; each group shows a running sum
- **Validation:** `target_allocation.json` uses absolute portfolio weights at all levels (e.g. `Small Cap Value: 0.10` = 10% of total portfolio, not 10% of parent). Validation rules:
  1. All top-level weights must sum to 1.0 (±0.001 tolerance) — hard error, blocks save
  2. Each nested weight must be ≥ 0 and ≤ its parent's weight — hard error, blocks save
  3. Sibling weights under a parent are expected to sum to the parent's weight — shown as an advisory warning (not a block), since the user may intentionally leave some allocation unassigned at a level
- Shows inline error per group, blocks save on rules 1 and 2
- Save button: POSTs to `/api/admin/allocation` which writes validated JSON back to `target_allocation.json`
- No hierarchy editing (add/remove/rename categories) — future phase

---

## Seed Data

On first run (or via a migration script `src/lib/db/seed_registry.ts`):

- Source: the Bogleheads reference data provided in the project (embedded directly in `seed_registry.ts` as a TypeScript array, since it was provided as a chat table rather than a committed file)
- Inserts all ~100 tickers into `asset_registry`
- Maps the `Type` column to the `weights` JSON (single-category tickers: `{ [type]: 1.0 }`)
- Multi-asset funds (VXUS, VTIAX, FZILX, etc.) get fractional weights matching the existing `ticker_map.json` (which has the correct blended weights for these)
- Script is idempotent (uses `INSERT OR IGNORE`)
- After seeding, `ticker_map.json` and `prices.json` are archived to `docs/archive/` before deletion — do not delete until at least one successful `runRefresh()` has completed
- `ticker_meta.json` and `fetch_meta.ts` are deleted (no live data worth archiving)

---

## Migration Path

1. Add new tables to `schema.sql`; run migration
2. Implement `refresh.ts` and `/api/refresh` route
3. Implement `seed_registry.ts`; run seed
4. Update `xray.ts`, `rebalancer.ts`, `efficiency.ts` to read from DB
5. Add no-data visibility indicators to dashboard and xray components
6. Implement `/admin/allocation` weight editor
7. Delete `ticker_map.json`, `prices.json`, `ticker_meta.json`

---

## Files Changed

| File | Action |
|---|---|
| `src/lib/db/schema.sql` | Add 3 new tables; add `nickname TEXT` to `accounts`; add `market_value REAL` to `holdings` (schema drift fix) |
| `src/lib/data/refresh.ts` | New — replaces `fetch_meta.ts` |
| `src/lib/db/seed_registry.ts` | New — seeds `asset_registry` |
| `src/app/api/refresh/route.ts` | New — POST endpoint |
| `src/instrumentation.ts` | New or update — calls refresh on startup |
| `src/lib/logic/xray.ts` | Update — migrate all three functions: `calculateHierarchicalMetrics`, `getCanonicalExposure`, and `calculateTrueConcentration`; replace all `tickerMap`/`prices` JSON imports with DB queries |
| `src/lib/logic/rebalancer.ts` | Update — (1) replace `tickerMap` import with `db.prepare("SELECT ticker, weights FROM asset_registry").all()`, parse `weights` JSON inline; (2) replace `require('../data/prices.json')` usage (portfolioValue calculation) with `getLatestPrice(ticker)` from `price_history` |
| `src/lib/logic/efficiency.ts` | Update — read from DB; remove `/ 100` from ER calculation (Yahoo stores as decimal, not percent) |
| `src/app/page.tsx` | Update — warning strip |
| `src/app/admin/allocation/page.tsx` | New — weight editor UI |
| `src/app/api/admin/allocation/route.ts` | New — saves allocation JSON |
| `src/lib/data/ticker_map.json` | Delete |
| `src/lib/data/prices.json` | Delete |
| `src/lib/data/ticker_meta.json` | Delete |
| `src/lib/data/fetch_meta.ts` | Delete |
