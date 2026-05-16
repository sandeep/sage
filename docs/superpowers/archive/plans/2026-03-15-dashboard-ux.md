# Dashboard UX & Risk Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a rich Stock Hover UI to the existing `MetricTable`, replace the Allocation DNA widget with a Risk & Concentration widget, and support custom Expense Ratios for Institutional Trusts.

**Architecture:** We will surgically update the SQLite schema and `xray.ts` logic to fetch deeper pricing, metadata, and per-account holding details. This enriched data will be passed to `MetricTable` to render a pure CSS `group-hover` tooltip. Finally, we will build a new `RiskWidget` component to surface single-stock concentration and actionable expense drags.

**Tech Stack:** Next.js 15, React, Tailwind CSS, better-sqlite3.

---

## Chunk 1: Institutional Trust ER Tracking

**Goal:** Allow `asset_registry` to override the public proxy's Expense Ratio with the true Institutional Trust ER.

**Files:**
- Modify: `src/lib/db/schema.sql`
- Modify: `src/lib/db/migrate.ts`
- Modify: `src/lib/logic/efficiency.ts`

- [x] **Step 1: Update schema definition**

In `src/lib/db/schema.sql`, add `custom_er REAL` to the `asset_registry` table definition.

- [x] **Step 2: Add migration for `custom_er`**

In `src/lib/db/migrate.ts`, add an idempotent column addition:
```typescript
try {
    db.prepare("ALTER TABLE asset_registry ADD COLUMN custom_er REAL").run();
} catch (e: any) {
    if (!e.message.includes('duplicate column name')) throw e;
}
```

- [x] **Step 3: Run migration manually to verify**

Run: `npm run tsx src/lib/db/migrate.ts`
Expected: Success

- [x] **Step 4: Update Efficiency Logic**

In `src/lib/logic/efficiency.ts`, update the query to pull `custom_er` from `asset_registry` and use it if available:

Update query:
```typescript
    const holdings = db.prepare(`
        SELECT h.ticker, h.quantity, h.market_value, a.tax_character, ar.custom_er
        FROM holdings h 
        JOIN accounts a ON h.account_id = a.id
        LEFT JOIN asset_registry ar ON h.ticker = ar.ticker
    `).all() as any[];
```
Update logic inside loop:
```typescript
        const meta = db.prepare(`SELECT yield, er FROM ticker_meta WHERE ticker = ?`).get(h.ticker) as any;
        const effectiveER = h.custom_er !== null ? h.custom_er : meta?.er;
        if (effectiveER != null) totalExpenseLeakage += value * effectiveER;
```

- [x] **Step 5: Commit Chunk 1**
```bash
git add src/lib/db/schema.sql src/lib/db/migrate.ts src/lib/logic/efficiency.ts
git commit -m "feat: support custom ERs for institutional trusts"
```

---

## Chunk 2: Data Enrichment for Hover UI

**Goal:** Enrich the `MetricTable` data payload with account breakdowns, pricing, and metadata.

**Files:**
- Modify: `src/lib/logic/xray.ts`

- [x] **Step 1: Update `MetricContributor` Interface**

In `src/lib/logic/xray.ts`:
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
    accounts: AccountHoldingDetail[];
    yield?: number;
    er?: number;
    close?: number;
    fiftyTwoWeekLow?: number;
    fiftyTwoWeekHigh?: number;
    name?: string;
}
```

- [x] **Step 2: Update `getContributors` Logic**

Modify `getContributors` to query the database for the missing data. 
Because `getContributors` is called multiple times, fetch the required data in a single pass before `calculateHierarchicalMetrics` loops, or fetch specifically inside the function.

```typescript
// Add to calculateHierarchicalMetrics initialization:
const accountHoldings = db.prepare(`
    SELECT h.ticker, h.account_id, COALESCE(a.nickname, a.id) as account_name, h.quantity, h.market_value
    FROM holdings h JOIN accounts a ON h.account_id = a.id
`).all() as any[];

const tickerMetadata = db.prepare(`
    SELECT t.ticker, t.name, t.yield, t.er, p.close, p.fiftyTwoWeekLow, p.fiftyTwoWeekHigh
    FROM ticker_meta t
    LEFT JOIN (
        SELECT ticker, close, fiftyTwoWeekLow, fiftyTwoWeekHigh, MAX(date) as latest 
        FROM price_history GROUP BY ticker
    ) p ON t.ticker = p.ticker
`).all() as any[];
```
Inside `getContributors`, map this data into the returned `MetricContributor` object.

- [x] **Step 3: Update `uncategorizedContributors` logic**

Ensure the `uncategorizedContributors` array also receives the enriched fields.

- [x] **Step 4: Commit Chunk 2**
```bash
git add src/lib/logic/xray.ts
git commit -m "feat: enrich x-ray metrics with account and metadata for hover UI"
```

---

## Chunk 3: Implement Stock Hover UI

**Goal:** Add the interactive tooltip directly into the `MetricTable`.

**Files:**
- Modify: `src/app/components/MetricTable.tsx`

- [x] **Step 1: Add Tooltip HTML/CSS to Instrument Row**

In `src/app/components/MetricTable.tsx`, locate the mapping for `showInstruments` (`m.contributors.map(c => ...)`).

Modify the `<tr>` to use `group relative cursor-help`.
Inside the ticker `<td>`, insert the absolute positioned tooltip `div` using `group-hover:block hidden absolute z-50`.

- [x] **Step 2: Bind Data to Tooltip**

Bind `c.name`, `c.value`, `c.yield`, `c.er`, `c.close`, `c.fiftyTwoWeekLow`, `c.fiftyTwoWeekHigh`, and map over `c.accounts` to build the Account Breakdown list exactly like the approved mockup.

- [x] **Step 3: Verify Tooltip Render**

Run `npm run dev` and verify hovering over an instrument row displays the detailed tooltip correctly without clipping.

- [x] **Step 4: Commit Chunk 3**
```bash
git add src/app/components/MetricTable.tsx
git commit -m "feat: implement stock hover details in MetricTable"
```

---

## Chunk 4: Risk & Concentration Widget

**Goal:** Replace `AssetXRay` (Allocation DNA) with a new `RiskWidget`.

**Files:**
- Create: `src/app/components/RiskWidget.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/lib/logic/xray.ts` (if new queries needed)

- [x] **Step 1: Create `RiskWidget.tsx` Component**

Build `src/app/components/RiskWidget.tsx` receiving a `risks` prop containing single-stock concentration data.

- [x] **Step 2: Add concentration query to `xray.ts`**

Add `export function getConcentrationRisks()` that sums value grouped by ticker (excluding Cash/Bonds/Broad Index if possible, focusing on individual equities) and returns tickers representing > 5% of portfolio.

- [x] **Step 3: Update `page.tsx`**

Replace `AssetXRay` import and usage with `RiskWidget`. Pass the results of `getConcentrationRisks()`.

- [x] **Step 4: Verify Dashboard**

Ensure the new widget renders cleanly and highlights major single-stock positions.

- [x] **Step 5: Commit Chunk 4**
```bash
git add src/app/components/RiskWidget.tsx src/app/page.tsx src/lib/logic/xray.ts
git commit -m "feat: replace Allocation DNA with Risk Concentration widget"
```
