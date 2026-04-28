# Stock Hover Details Design

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Display rich holding details (accounts, quantities, values) and metadata via a hover tooltip on the main Dashboard MetricTable.

---

## Problem
Currently, the `MetricTable` on the main dashboard shows aggregated asset class categories and expands down to individual tickers (e.g., `FZROX`). However, users cannot see *where* that ticker is actually held without navigating away to the dedicated `/holdings` page. 

## Goals
1. Provide instant visibility into exactly which accounts hold a specific ticker without leaving the main dashboard.
2. Present this information via a non-intrusive hover state on the ticker rows within `MetricTable`.
3. Display relevant metadata (Yield, ER) if available.

---

## Architecture & Data Flow

### 1. Data Fetching
The existing `calculateHierarchicalMetrics` function in `src/lib/logic/xray.ts` returns a flat array of `MetricRow` objects. Each `MetricRow` can contain `contributors` (the tickers). 

Currently, `contributors` is just `{ ticker, value, pct }`. We need to enrich this.

We will update the backend logic so that when it resolves the `tickerValues`, it also aggregates the per-account breakdown for each ticker.

**Updated `MetricContributor` Interface:**
```typescript
export interface AccountHoldingDetail {
    accountId: string;
    accountName: string;
    quantity: number;
    value: number;
}

export interface MetricContributor {
    ticker: string;
    value: number;
    pct: number;
    accounts: AccountHoldingDetail[]; // New
    yield?: number; // New
    er?: number;    // New
}
```

### 2. X-Ray Logic Updates (`src/lib/logic/xray.ts`)
Instead of just tracking total value per ticker, we will query the DB to join `holdings` with `accounts` and `ticker_meta` to build the full profile for every ticker during the X-Ray pass. 
*   We will fetch the `nickname` for the account display.
*   We will attach the `yield` and `er` from `ticker_meta`.

### 3. UI Component (`src/app/components/MetricTable.tsx`)
We will introduce a `group` hover state on the `<tr>` for the instrument rows in the `MetricTable`. 

Inside the instrument row, we will embed an absolute-positioned, custom styled tooltip (`div`) that becomes visible on hover. 

**Tooltip Design:**
*   **Header:** Ticker symbol and total value.
*   **Metadata Strip:** Yield (%) and Expense Ratio (%).
*   **Account Breakdown:** A mini-table or list showing each account name and the dollar value of the holding in that account.

**Interaction:**
*   Hovering over the ticker name (e.g., `FZROX`) triggers the tooltip.
*   The tooltip anchors next to the cursor or relative to the table cell, ensuring it doesn't clip off-screen.

---

## Files Changed

| File | Action |
|---|---|
| `src/lib/logic/xray.ts` | Enrich `MetricContributor` with per-account array and metadata. |
| `src/app/components/MetricTable.tsx` | Build and implement the hover tooltip UI for ticker rows. |