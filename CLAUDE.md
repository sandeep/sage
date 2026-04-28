# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
PORT=3005 npm run dev          # Run Next.js dev server on port 3005

# Maintenance / Troubleshooting
# If build fails with SIGKILL or obscure module errors:
rm -rf node_modules .next && npm install

# After any work done inside a Linux container/workspace, the better-sqlite3
# native module will be compiled for Linux. Running npm run dev on Mac will
# crash immediately with "invalid ELF header". Fix by rebuilding for your OS:
npm rebuild better-sqlite3
npm install --cpu=arm64 --os=linux lightningcss  # if next/font fails with lightningcss.linux-arm64-gnu.node

# Bootstrap / seed the database from scratch
npm run bootstrap              # Runs src/lib/db/bootstrap.ts via ts-node

# Tests
npx vitest                     # Run all tests
npx vitest run src/lib/logic/__tests__/xray.test.ts   # Run a single test file
npx vitest --reporter=verbose  # Verbose output

# Lint
npm run lint
```

## Architecture Overview

Sage is a **local-first** Next.js 15 app (App Router, React Server Components). All data lives in a single SQLite file (`sage.db`) accessed via `better-sqlite3`. There is no external database.

### Data Flow

```
Fidelity/Schwab CSV
  → /api/upload  (src/lib/ingest/)
  → holdings table in sage.db
  → /api/refresh  (src/lib/data/refresh.ts)
      → Yahoo Finance / Alpha Vantage price fetch
      → price_history + ticker_meta tables
  → page.tsx (RSC) calls generateDirectives() + calculateHierarchicalMetrics()
      → Directives table + MetricRow[] rendered to UI
```

### Database Layer (`src/lib/db/`)

- **`client.ts`** — singleton `better-sqlite3` instance. Uses `:memory:` when `VITEST=true` or `NODE_ENV=test`, so tests never touch `sage.db`.
- **`schema.sql`** — source of truth for all tables.
- **`migrate.ts`** — idempotent `ALTER TABLE` migrations run on every startup via `runMigrations(db)`.
- **`allocation.ts`** — reads `allocation_nodes` table and reconstructs the 3-level allocation tree used throughout the app.
- **`prices.ts`** — `getLatestPrice(ticker)` and `getTickerMap()` helpers used by logic layer.

Key tables: `accounts`, `holdings`, `asset_registry`, `price_history`, `ticker_meta`, `allocation_nodes`, `directives`, `performance_snapshots`.

### Logic Layer (`src/lib/logic/`)

The core computation pipeline — all functions are synchronous and read directly from SQLite:

- **`xray.ts`** — `calculateHierarchicalMetrics()` is the central function. It reads all holdings, applies ETF look-through from `etf_composition`, maps to `asset_registry` weights, and produces `MetricRow[]` for 3-level drift analysis (Level 0 = Stock/Bond/Cash, Level 1 = geo buckets, Level 2 = asset classes).
- **`rebalancer.ts`** — `generateDirectives()` calls `calculateHierarchicalMetrics()`, finds over/under-weight Level-2 categories (>2% drift), and writes tranche-sized (`$20k max`) BUY/SELL directives to the `directives` table. Cash deployment is handled separately per account.
- **`allocationSimulator.ts`** — maps allocation leaf labels to ETF proxies (`ETF_PROXY_MAP`) and Simba backtesting labels (`SIMBA_MAP`). Provides `flattenLeafWeights()` to convert the nested tree to leaf weights.
- **`portfolioEngine.ts`** — reconstructs daily NAV from static holdings × `price_history`. Computes 1Y return, vol, Sharpe, Sortino, Beta vs VTI. Holdings are treated as a static snapshot (no buy/sell history).
- **`alpha.ts`**, **`efficiency.ts`**, **`performanceMetrics.ts`** — supporting math (Sharpe/Sortino formulas, alpha computation, efficiency metrics).
- **`xray_risks.ts`** — `getConcentrationRisks()` and `getExpenseRisks()` for the RiskWidget.

### Data Refresh (`src/lib/data/`)

- **`refresh.ts`** — multi-source price refresh with fallback chain: Yahoo Finance → Alpha Vantage. Uses `ALPHA_VANTAGE_API_KEY` from `.env.local` (25 req/day free tier). Tickers with `**` or `CASH` are hard-coded to price 1.0.
- **`priceRefresh.ts`** — raw fetch helpers for Yahoo and AV (current price + history).

### API Routes (`src/app/api/`)

All routes are Next.js Route Handlers. Key ones:
- `POST /api/upload` — CSV ingestion, creates accounts and holdings
- `POST /api/refresh` — triggers price + ETF composition refresh
- `GET/PUT /api/admin/allocation` — reads/writes `allocation_nodes` table
- `GET /api/performance/comparison` — returns `comparisonEngine` results
- `POST /api/directives` — updates directive status (ACCEPTED/SNOOZED/EXECUTED)

### Pages (all React Server Components except where noted)

- `/` (`page.tsx`) — calls `generateDirectives()` on every load, then renders MetricTable + TaskBlotter
- `/accounts` — account mapper + holdings breakdown
- `/admin/allocation` — AllocationEditor for editing target weights
- `/audit` — markdown audit trail viewer
- `/holdings` — full holdings table

### Allocation Tree Structure

The 3-level hierarchy is stored in `allocation_nodes` and mirrors `src/lib/data/target_allocation.json`:
- Level 0: top-level buckets (Stock, Bond, Cash)
- Level 1: geo/type buckets (US Stock, Int'l Stock, Bond, etc.)
- Level 2: leaf asset classes (Total Stock Market, Small Cap Value, REIT, etc.)

`getAllocationTree()` in `src/lib/db/allocation.ts` reconstructs the JSON shape from the flat table. The `label` field is used as the join key across all logic — it must match exactly between `allocation_nodes`, `asset_registry.weights` (JSON), and `ETF_PROXY_MAP`.

### Asset Registry

`asset_registry` is the ticker map. Each row has:
- `ticker` — the brokerage ticker (e.g. `VTI`, `FZROX`)
- `canonical` — display name
- `weights` — JSON object mapping Level-2 allocation labels to fractional weights (e.g. `{"Total Stock Market": 1.0}` or `{"Developed Market": 0.75, "Emerging Market": 0.25}` for VXUS)
- `is_core` — 1 if this is a preferred buy candidate for directives
- `asset_type` — `ETF`, `STOCK`, `FUND`, `MUTUAL_FUND`, `CASH`

### Testing

Tests use Vitest with `jsdom` environment and `singleFork` pool (required for SQLite). Each test file sets up an in-memory DB (the client auto-detects `VITEST=true`). Test files live at `src/lib/logic/__tests__/`.

### Environment Variables (`.env.local`)

- `ALPHA_VANTAGE_API_KEY` — optional fallback for price fetching (25 req/day)
- `FINANCIAL_MODELING_PREP_API_KEY` — available but not actively used

### Sync / Audit Trail (`src/lib/sync/`)

`markdown.ts` writes append-only markdown snapshots to the `conductor/` and `sage/` directories for audit purposes. Called from the rebalancer after directive generation.
