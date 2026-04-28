# Rebalancer Logic Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Upgrade the `rebalancer.ts` logic engine to generate realistic, actionable directives instead of micro-transactions (e.g., $0.17), fix prioritization logic, and ensure it respects true portfolio scale.

**Architecture:** The current logic calculates drift purely based on percentages and generates a directive for *any* drift over 2%, scaling to the `portfolioValue`. We need to introduce absolute minimum transaction thresholds ($500), better drift tolerances (relative vs absolute), and ensure the `portfolioValue` accurately reflects all priced and manually-priced assets (like cash).

**Tech Stack:** TypeScript, SQLite.

---

## Chunk 1: Portfolio Valuation Fix

**Problem:** The rebalancer calculates `portfolioValue` by multiplying quantity * `price_history`. It currently ignores `market_value` for unpriced assets (like Cash or Institutional Trusts), causing the total portfolio value to be artificially low, resulting in micro-dollar directives.

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`

- [x] **Step 1: Update `portfolioValue` calculation**

In `src/lib/logic/rebalancer.ts`, update the calculation to use `market_value` first, then fall back to `price_history`, exactly as `resolveValue` does in `xray.ts`.

Find:
```typescript
    const holdings = db.prepare("SELECT ticker, quantity FROM holdings").all() as any[];
    const portfolioValue = holdings.reduce((acc, h) => {
        const price = getLatestPrice(h.ticker);
        return acc + (price !== null ? h.quantity * price : 0);
    }, 0) || 1;
```

Replace with:
```typescript
    const holdings = db.prepare("SELECT ticker, quantity, market_value FROM holdings").all() as any[];
    const portfolioValue = holdings.reduce((acc, h) => {
        if (h.market_value !== null && h.market_value > 0) return acc + h.market_value;
        const price = getLatestPrice(h.ticker);
        return acc + (price !== null ? (h.quantity || 0) * price : 0);
    }, 0) || 1;
```

## Chunk 2: Minimum Thresholds & Priority Logic

**Problem:** The engine flags any 2% drift, even if it equates to a tiny dollar amount. It also categorizes everything >10% drift as HIGH priority indiscriminately.

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`

- [x] **Step 1: Introduce `MIN_TRANSACTION_SIZE`**

Add a constant at the top of the file:
```typescript
const MIN_TRANSACTION_SIZE = 500; // Ignore sub-$500 trades
```

- [x] **Step 2: Filter micro-directives**

Inside the loop, immediately after calculating `driftDollar`:

```typescript
        let driftDollar = Math.abs(driftAmount * portfolioValue);

        // Ignore micro-drifts and noise
        if (driftDollar < MIN_TRANSACTION_SIZE) return;
```

- [x] **Step 3: Fix Priority Logic**

Update the priority assignment to be a function of the absolute dollar amount at stake, rather than just raw percentage drift, making the queue more meaningful.

Replace:
```typescript
priority: driftAmount > 0.1 ? 'HIGH' : 'MEDIUM',
```
With:
```typescript
priority: driftDollar > 50000 ? 'HIGH' : driftDollar > 10000 ? 'MEDIUM' : 'LOW',
```
*(Do this for both BUY and SELL blocks)*

## Chunk 4: Cash-Aware Directive Routing

**Problem:** The rebalancer ignores cash positions when deciding where to buy. It picks accounts arbitrarily (first TAXABLE, first account) rather than routing buys to accounts that actually have uninvested cash. It also doesn't surface "deploy cash" as a distinct action type.

**Context:**
- Cash holdings appear in `holdings` with `ticker` values like `CASH`, `SPAXX**`, `FDRXX**` (money market / settlement funds). These have `market_value` set.
- Each account may have one or more cash-like positions summing to its available cash balance.
- New contributions (external money coming in) are represented as incoming cash — currently there's no explicit field for this, but it can be inferred from cash balance growth.

**Rules to implement:**

1. **Prefer accounts with available cash for BUY directives.** Before assigning a BUY directive to an account, check if that account has a cash/money-market balance. If yes, the buy should come from that cash — label it "Deploy $Xk cash → BUY {TICKER}" rather than a generic buy.

2. **Cash deployment priority.** If an account has significant idle cash (>$1k), generate BUY directives that route into the most underweight categories first. This is a "new money" path vs a "rebalance" path.

3. **SELL → BUY pairing.** When a SELL directive exists (overweight category), pair it with an appropriate BUY directive in the same account to avoid unnecessary cross-account transfers. Prefer same-account sell + buy where tax character allows.

4. **Account cash summary.** Expose per-account cash balance in the directive `reasoning` field so the user sees: "Fidelity IRA: $12.4k uninvested — deploy into Developed Market."

**Schema addition needed:** Add `account_cash_available` column to directive, or encode in reasoning. No schema migration needed if encoded in reasoning string.

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`

- [x] **Step 1: Add `getCashByAccount()` helper**

```typescript
function getCashByAccount(): Record<string, number> {
    const CASH_TICKERS = /^(CASH|SPAXX|FDRXX|VMFXX|FZDXX|SPRXX)/i;
    const rows = db.prepare(`
        SELECT account_id, SUM(COALESCE(market_value, quantity)) as cash
        FROM holdings
        WHERE ticker REGEXP ? OR ticker LIKE '%**%'
        GROUP BY account_id
    `).all(CASH_TICKERS.source) as { account_id: string; cash: number }[];
    // Fallback: SQLite has no REGEXP by default; use multiple LIKEs
    const cashRows = db.prepare(`
        SELECT account_id,
               SUM(COALESCE(market_value, quantity)) as cash
        FROM holdings
        WHERE ticker = 'CASH'
           OR ticker LIKE 'SPAXX%' OR ticker LIKE 'FDRXX%'
           OR ticker LIKE 'VMFXX%' OR ticker LIKE '%**%'
        GROUP BY account_id
    `).all() as { account_id: string; cash: number }[];
    return Object.fromEntries(cashRows.map(r => [r.account_id, r.cash]));
}
```

- [x] **Step 2: Prefer cash-holding accounts for BUY directives**

When selecting `buyVenue` for a BUY directive, sort candidate accounts by their available cash descending:
```typescript
const cashByAccount = getCashByAccount();
const buyVenue = accounts
    .sort((a, b) => (cashByAccount[b.id] ?? 0) - (cashByAccount[a.id] ?? 0))[0];
```

- [x] **Step 3: Surface cash deployment as distinct action**

After generating drift-based directives, scan all accounts for idle cash > $1k and generate additional BUY directives:
```typescript
for (const [accountId, cashBalance] of Object.entries(cashByAccount)) {
    if (cashBalance < 1000) continue;
    const account = accounts.find(a => a.id === accountId);
    if (!account) continue;
    // Most underweight category for this account's tax character
    const target = underWeight[0]; // simplification; full logic picks best fit
    if (!target) continue;
    directives.push({
        type: 'BUY',
        description: `Deploy $${(Math.min(cashBalance, MAX_TRANCHE_SIZE) / 1000).toFixed(1)}k cash → Buy ${target.label} in ${account.nickname || accountId}`,
        priority: cashBalance > 10000 ? 'HIGH' : 'MEDIUM',
        reasoning: `$${(cashBalance / 1000).toFixed(1)}k uninvested in ${account.nickname || accountId}`,
        link_key: target.label,
    });
}
```

- [x] **Step 4: Commit**
```bash
git add src/lib/logic/rebalancer.ts
git commit -m "feat: cash-aware directive routing"
```

---

## Chunk 3: Actionable Language

**Problem:** The reasoning text is currently dry and repetitive. 

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`

- [x] **Step 1: Enhance the `reasoning` string**

Update the reasoning string to include the dollar amount required to restore balance.

Replace SELL reasoning:
```typescript
reasoning: `${m.label} is ${(driftAmount * 100).toFixed(1)}% over target weight. Reallocating capital improves efficiency.`
```
Replace BUY reasoning:
```typescript
reasoning: `${m.label} is underfunded by $${driftDollar.toLocaleString(undefined, {maximumFractionDigits:0})}. Strategic location in ${buyName} (${buyVenue.tax_character}).`
```