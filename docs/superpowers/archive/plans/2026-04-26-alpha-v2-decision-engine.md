# Alpha v2 Decision Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Alpha Portfolio tracker into a decision engine that compares active trading performance against a passive VTI "Shadow Portfolio" across three asset class pillars (Equities, Options, Futures).

**Architecture:** 
1. **Shadow Ledger:** Track every deposit as a hypothetical VTI purchase.
2. **MTM Backfill:** Fetch historical daily prices for all alpha tickers to enable true Mark-to-Market (MTM) and Money-Weighted Return (MWR) calculations.
3. **Three-Gate Benchmarking:** Segment performance metrics by instrument type with specific benchmark correlations.

**Tech Stack:** TypeScript, Next.js, better-sqlite3, D3.js (via Recharts).

---

### Task 1: Database Schema Expansion

**Files:**
- Modify: `src/lib/db/migrate.ts` (or create a new migration if applicable)

- [ ] **Step 1: Define the Shadow VTI table schema**
Add `alpha_shadow_vti` table to track the daily value and share balance of the hypothetical benchmark portfolio.

```sql
CREATE TABLE IF NOT EXISTS alpha_shadow_vti (
    date TEXT PRIMARY KEY,
    shares REAL NOT NULL,
    price REAL NOT NULL,
    value REAL NOT NULL,
    cumulative_deposits REAL NOT NULL
);
```

- [ ] **Step 2: Apply migration**
Run: `npm run bootstrap` (or equivalent migration command)
Expected: Table exists in `sage.db`.

- [ ] **Step 3: Commit**
```bash
git add src/lib/db/migrate.ts
git commit -m "db: add alpha_shadow_vti table"
```

---

### Task 2: Market Data Backfill for Alpha Tickers

**Files:**
- Create: `src/lib/logic/alpha/engine/priceSync.ts`
- Modify: `src/lib/data/priceRefresh.ts`

- [ ] **Step 1: Write failing test for ticker discovery**
Verify we can identify all tickers from `alpha_equity_trades` and `alpha_option_trades` that lack history.

- [ ] **Step 2: Implement `syncAlphaPriceHistory`**
Use `yfHistoricalPrices` from `src/lib/data/priceRefresh.ts` to fetch and store missing history.

```typescript
export async function syncAlphaPriceHistory() {
    const tickers = db.prepare(`
        SELECT DISTINCT instrument FROM alpha_equity_trades
        UNION
        SELECT DISTINCT instrument FROM alpha_option_trades
    `).all();
    // ... loop and fetch
}
```

- [ ] **Step 3: Run sync and verify database**
Run: `npx ts-node -e "require('./src/lib/logic/alpha/engine/priceSync').syncAlphaPriceHistory()"`
Expected: `price_history` table populated with alpha tickers (TSLA, META, etc.).

- [ ] **Step 4: Commit**
```bash
git add src/lib/logic/alpha/engine/priceSync.ts
git commit -m "feat: add alpha price sync logic"
```

---

### Task 3: The Shadow VTI Engine

**Files:**
- Create: `src/lib/logic/alpha/engine/shadowPortfolio.ts`

- [ ] **Step 1: Implement `reconstructShadowVti`**
For every deposit/withdrawal in `alpha_transactions`, buy/sell VTI shares. Then project the daily value using `price_history`.

```typescript
export async function reconstructShadowVti() {
    const transactions = db.prepare("SELECT * FROM alpha_transactions WHERE book IN ('DEPOSIT', 'WITHDRAWAL') ORDER BY activity_date").all();
    // ... share balance logic
}
```

- [ ] **Step 2: Verify Shadow NAV vs Total Deposited**
Run test to ensure `value` at any point reflects price * shares.

- [ ] **Step 3: Commit**
```bash
git add src/lib/logic/alpha/engine/shadowPortfolio.ts
git commit -m "feat: implement shadow vti reconstruction"
```

---

### Task 4: Multi-Gate Metrics Overhaul (MWR & Alpha)

**Files:**
- Modify: `src/lib/logic/alpha/engine/metrics.ts`

- [ ] **Step 1: Implement MWR (Money-Weighted Return) helper**
Since we now have cash flow dates and MTM values, we can calculate IRR/MWR for each book.

- [ ] **Step 2: Update `calculateAlphaMetrics`**
Add `dollarAlpha` and `shadowNav` to the returned object.

```typescript
export interface AlphaMetrics {
    // ... existing
    dollarAlpha: number;
    shadowNav: number;
    mwr: number;
}
```

- [ ] **Step 3: Update `getBookTradeStats`**
Add benchmarking logic per asset class (Equities vs VTI, etc.).

- [ ] **Step 4: Commit**
```bash
git add src/lib/logic/alpha/engine/metrics.ts
git commit -m "feat: update alpha metrics with MWR and Dollar Alpha"
```

---

### Task 5: UI Integration (Decision Engine Dashboard)

**Files:**
- Modify: `src/app/alpha/page.tsx`
- Modify: `src/app/alpha/AlphaNavChart.tsx`

- [ ] **Step 1: Add Shadow Portfolio Tiles**
Add "Dollar Alpha" and "Shadow Portfolio Value" metrics to the top row.

- [ ] **Step 2: Update Instrument Pillars**
Refactor the "Performance By Book" section to include benchmarking metrics (Beta, Yield Alpha).

- [ ] **Step 3: Update NAV Chart Overlay**
Add the Shadow VTI line to the chart.

- [ ] **Step 4: Verify UI**
Run: `npm run dev` and navigate to `/alpha`.
Expected: New metrics visible, chart shows two lines.

- [ ] **Step 5: Commit**
```bash
git add src/app/alpha/page.tsx src/app/alpha/AlphaNavChart.tsx
git commit -m "ui: update alpha dashboard to v2 decision engine"
```
