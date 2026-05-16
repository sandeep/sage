# Snapshot Browser Design

**Date:** 2026-03-26
**Status:** Approved
**Branch:** feat/v2-performance-rebuild

---

## Overview

A read-only audit surface that makes the holdings ledger visible and meaningful. Two integrated features:

1. `/admin/snapshots` — a new page showing the portfolio's history snapshot by snapshot
2. Efficient Frontier overlay — each snapshot plotted as a waypoint on the existing `/performance` scatter chart

The core value: turning `holdings_ledger` from an invisible append-only table into a visible record of strategic progress.

---

## Architecture

All data flows from three existing sources — no new data fetching infrastructure needed:

```
holdings_ledger          → snapshot rows, position counts, total value, allocation mix
allocation_nodes         → target weights (for drift score calculation)
snapshot_metadata        → optional label per snapshot_date (new table, already migrated)
```

The page is a React Server Component. No client interactivity except the row expansion (handled with a `<details>` element or a minimal `'use client'` accordion component).

The label field is the only write operation — handled via a small API route `PATCH /api/admin/snapshots/[date]/label`.

---

## Page: `/admin/snapshots`

### Headline strip

One hero block at the top showing the full portfolio arc:

```
FIRST SNAPSHOT      LATEST           TOTAL GROWTH
Dec 2024            Mar 2026         +$102,400 (+12.9%)    over 15 months
```

- Derived from `MIN(snapshot_date)` and `MAX(snapshot_date)` in `holdings_ledger`
- Growth = latest total value minus first total value (raw, not return — contributions included)
- Duration in months between first and latest snapshot
- If only one snapshot exists, show "No comparison available yet"

### Snapshot table

One row per distinct `snapshot_date`, ordered newest first.

**Columns:**

| Column | Description |
|---|---|
| Date | `snapshot_date` formatted as "Mon YYYY" |
| Label | Optional free-text, editable inline |
| Total Value | `SUM(market_value)` for that date |
| Δ Growth | Dollar + % change vs previous snapshot. Label is "Growth" not "Return" — capital additions make return misleading |
| Allocation Mix | Mini proportional bar (Stock / Bond / Cash) + percentage numbers e.g. `78 / 18 / 4` |
| Drift Score | Sum of absolute deviations of L2 allocation from target. Color-coded: green <3%, yellow 3–6%, red >6% |
| Positions | Count of distinct tickers for that snapshot |

### Row expansion

Click a row to expand:
- Full holdings list for that snapshot (ticker, quantity, market value, weight %)
- **Biggest movers vs previous** — top 5 position weight changes: "AVUV +4.2% | BND −2.1%"
- L2 drift table: every asset class, actual vs target, delta

### Label editing

Inline — click the label cell, type, blur to save. `PATCH /api/admin/snapshots/[date]/label` writes to `snapshot_metadata`. No optimistic update needed given this is an admin tool.

---

## Efficient Frontier Overlay

Extends `EfficiencyMapV2` and `EfficiencyMapClientV2`.

- For each snapshot date, compute the portfolio's (volatility, return) coordinates using the same Simba backtest methodology already in `simbaEngine.ts`
- Plot each snapshot as a labeled dot on the existing scatter
- Connect dots chronologically with a thin line (the portfolio's "journey")
- The frontier scatter (all strategy configurations) stays unchanged — it's the fixed landscape
- Dot labels: "Dec 24", "Jan 25", "Mar 26" etc.
- If only one snapshot, show the single dot with no line

The coordinates per snapshot are computed server-side in `EfficiencyMapV2` and passed to the client component as an additional prop `snapshotTrail: { date: string; x: number; y: number; label: string }[]`.

---

## Data Layer

### New SQL queries (co-located in page or a thin query module)

```sql
-- Headline
SELECT
  MIN(snapshot_date) as first_date,
  MAX(snapshot_date) as latest_date,
  SUM(CASE WHEN snapshot_date = (SELECT MAX(snapshot_date) FROM holdings_ledger) THEN market_value ELSE 0 END) as latest_value,
  SUM(CASE WHEN snapshot_date = (SELECT MIN(snapshot_date) FROM holdings_ledger) THEN market_value ELSE 0 END) as first_value
FROM holdings_ledger;

-- Per-snapshot summary
SELECT
  h.snapshot_date,
  sm.label,
  SUM(h.market_value) as total_value,
  COUNT(DISTINCT h.ticker) as position_count
FROM holdings_ledger h
LEFT JOIN snapshot_metadata sm ON h.snapshot_date = sm.snapshot_date
GROUP BY h.snapshot_date
ORDER BY h.snapshot_date DESC;
```

Allocation mix and drift score computed in TypeScript from allocation_nodes after the SQL query — reuses existing `getAllocationTree()` and `calculateHierarchicalMetrics()` patterns.

### New table (already migrated)

```sql
CREATE TABLE IF NOT EXISTS snapshot_metadata (
    snapshot_date TEXT PRIMARY KEY,
    label         TEXT
);
```

### New API route

`PATCH /api/admin/snapshots/[date]/label`
Body: `{ label: string }`
Writes to `snapshot_metadata` via `INSERT OR REPLACE`.

---

## What's Out of Scope

- Delete / merge snapshots
- CAGR (needs contribution tracking to separate performance from deposits)
- Export / download
- Date range filtering (small dataset, show all)

---

## Build Order

1. ~~`snapshot_metadata` table in `migrate.ts`~~ ✅ Done
2. Query module: `src/lib/logic/snapshotBrowser.ts` — headline + table data + expansion data
3. `/admin/snapshots` RSC page + label API route
4. Efficient Frontier overlay in `EfficiencyMapV2` / `EfficiencyMapClientV2`
5. Add "Snapshots" to NavBar
