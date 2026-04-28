# Rebalancer: Account-Aware Directive Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Rewrite `generateDirectives()` so every directive is self-contained within a single account — no cross-account pairings, no buy directives for accounts with no cash or holdings to swap from.

**Architecture:** Three-pass algorithm: (1) deploy idle cash within an account, (2) within-account swaps where one account holds overweight AND is the right tax venue for underweight, (3) standalone trims for overweight positions with no matching buy side. Banking and UNKNOWN accounts always excluded. `TaskBlotter` gets a minimal visual indicator for REBALANCE directives.

**Tech Stack:** TypeScript, better-sqlite3, Vitest. No new dependencies.

---

## File Map

| File | Change |
|---|---|
| `src/lib/logic/rebalancer.ts` | Full algorithm rewrite — new helpers + 3-pass `generateDirectives` |
| `src/lib/logic/__tests__/rebalancer.test.ts` | Update 2 existing tests + add 4 new tests |
| `src/app/components/TaskBlotter.tsx` | Add REBALANCE type badge (both legs already in description string) |

---

## Context for the Implementer

### Why the current algorithm is wrong

`generateDirectives()` currently runs two independent passes:
1. Find accounts holding overweight tickers → emit SELL
2. Find accounts with the right tax character for underweight categories → emit BUY

These are emitted as separate directives with no connection. The blotter displays them side-by-side implying a coordinated rebalance. But they are NOT coordinated — a SELL in Vanguard Rollover IRA and a BUY in Vanguard Roth IRA are two completely independent actions with no cash flow between them. Money cannot move between accounts automatically.

### What the new algorithm does

A BUY directive is only valid if the account already has the cash to fund it:
- **DEPLOY_CASH** (type=`BUY`): account has idle CASH/money-market → deploy into underweight category
- **REBALANCE**: account holds overweight ticker AND is the preferred tax venue for an underweight category → sell one, buy the other in the same account
- **SELL**: account is overweight but no matching buy opportunity in that account → trim and hold proceeds as cash (DEPLOY_CASH cycle picks it up next time)

Never emit a BUY directive for an account that has neither idle cash nor an overweight holding to sell.

### `buildAccountHoldings` — important implementation detail

When multiple tickers in one account map to the same L2 category (e.g. VTI + FZROX both → "Total Stock Market"), the function must:
1. **Sum** all exposures into `value` (total dollar exposure to this category in this account)
2. **Track the best sell candidate** — the ticker with the largest single-holding exposure

The bug to avoid: do NOT compare `exposure > existing.value - exposure` after incrementing `existing.value`. By that point `existing.value` includes the current ticker, so `existing.value - exposure` is the running total of all prior tickers — not the single best ticker seen so far. Track `bestSingleExposure` as a separate field:

```typescript
interface CategoryExposure {
    ticker: string;           // ticker with the largest single-holding exposure
    value: number;            // total exposure across all tickers in this category
    bestSingleExposure: number; // exposure of just `ticker` — used for best-sell tracking
}
```

### Account label disambiguation

Two accounts can produce the same display label (e.g. two "Rollover IRA" accounts at Fidelity). When this happens, append the last 4 characters of the account ID as a suffix: `"FIDELITY Rollover IRA (·1213)"`.

### Existing test setup quirk

The existing rebalancer tests call `seedAllocation()` but do NOT seed `asset_registry`. The new algorithm requires registry entries to compute `categoryExposure`, so the tests must seed VTI and FSRNX into `asset_registry` in `beforeAll`. Add `DELETE FROM asset_registry` to `beforeEach` to prevent cross-test contamination, and re-seed minimal registry in each test that needs it.

---

## Task 1: Update Tests

**Files:**
- Modify: `src/lib/logic/__tests__/rebalancer.test.ts`

 - [x] **Step 1: Rewrite the test file**

Replace the entire file with:

```typescript
// src/lib/logic/__tests__/rebalancer.test.ts
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { generateDirectives } from '../rebalancer';
import { seedAllocation } from '../../db/seed_allocation';
import db from '../../db/client';

function seedMinimalRegistry() {
    db.prepare(`INSERT OR IGNORE INTO asset_registry (ticker, canonical, weights, asset_type, is_core)
        VALUES ('VTI', 'Total US Stock Market', '{"Total Stock Market":1.0}', 'ETF', 0)`).run();
    db.prepare(`INSERT OR IGNORE INTO asset_registry (ticker, canonical, weights, asset_type, is_core)
        VALUES ('FSRNX', 'US Real Estate', '{"REIT":1.0}', 'FUND', 1)`).run();
}

describe('rebalancer', () => {
    beforeAll(() => {
        seedAllocation();
    });

    beforeEach(() => {
        db.prepare('DELETE FROM holdings').run();
        db.prepare('DELETE FROM accounts').run();
        db.prepare('DELETE FROM directives').run();
        db.prepare('DELETE FROM asset_registry').run();
        seedMinimalRegistry();
    });

    // ── Core directive routing ──────────────────────────────────────────────

    it('generates a REBALANCE directive routing REIT into the only available account', async () => {
        // acc-deferred holds VTI → TSM is overweight. REIT is underweight.
        // ROTH is not available so DEFERRED becomes the preferred venue for REIT.
        // Pass 2: same account holds overweight AND is preferred for REIT → REBALANCE within account.
        db.prepare(`INSERT INTO accounts (id, provider, tax_character, account_type)
            VALUES ('acc-deferred', 'FIDELITY', 'DEFERRED', 'IRA')`).run();
        db.prepare(`INSERT INTO holdings (account_id, ticker, quantity, market_value, asset_type)
            VALUES ('acc-deferred', 'VTI', 100, 25000, 'EQUITY')`).run();

        await generateDirectives();
        const directives = db.prepare('SELECT * FROM directives').all() as any[];
        const reitDirective = directives.find((d: any) => d.link_key === 'REIT');

        expect(reitDirective).toBeDefined();
        expect(reitDirective.type).toBe('REBALANCE');
        expect(reitDirective.description).toContain('acc-deferred');
        expect(reitDirective.description).toMatch(/swap/i);
    });

    it('routes REIT REBALANCE to ROTH account when both ROTH and DEFERRED are available', async () => {
        // acc-roth holds VTI (overweight TSM). acc-deferred-2 is empty.
        // ROTH is preferred for REIT (per taxPlacement). Pass 2 uses acc-roth.
        // acc-deferred-2 has no holdings → never gets a directive.
        db.prepare(`INSERT INTO accounts (id, provider, tax_character, account_type)
            VALUES ('acc-roth', 'FIDELITY', 'ROTH', 'ROTH_IRA')`).run();
        db.prepare(`INSERT INTO accounts (id, provider, tax_character, account_type)
            VALUES ('acc-deferred-2', 'FIDELITY', 'DEFERRED', 'IRA')`).run();
        db.prepare(`INSERT INTO holdings (account_id, ticker, quantity, market_value, asset_type)
            VALUES ('acc-roth', 'VTI', 100, 25000, 'EQUITY')`).run();

        await generateDirectives();
        const directives = db.prepare('SELECT * FROM directives').all() as any[];
        const reitDirective = directives.find((d: any) => d.link_key === 'REIT');

        expect(reitDirective).toBeDefined();
        expect(reitDirective.type).toBe('REBALANCE');
        expect(reitDirective.description).toContain('acc-roth');
        expect(reitDirective.description).not.toContain('acc-deferred-2');
    });

    // ── Account type exclusions ─────────────────────────────────────────────

    it('never generates any directive for a BANKING account', async () => {
        db.prepare(`INSERT INTO accounts (id, provider, tax_character, account_type)
            VALUES ('acc-bank', 'USAA', 'TAXABLE', 'BANKING')`).run();
        db.prepare(`INSERT INTO accounts (id, provider, tax_character, account_type)
            VALUES ('acc-brokerage', 'FIDELITY', 'TAXABLE', 'BROKERAGE')`).run();
        db.prepare(`INSERT INTO holdings (account_id, ticker, quantity, market_value, asset_type)
            VALUES ('acc-bank', 'VTI', 500, 100000, 'EQUITY')`).run();
        db.prepare(`INSERT INTO holdings (account_id, ticker, quantity, market_value, asset_type)
            VALUES ('acc-brokerage', 'VTI', 100, 20000, 'EQUITY')`).run();

        await generateDirectives();
        const directives = db.prepare('SELECT * FROM directives').all() as any[];
        expect(directives.find((d: any) => d.description.includes('acc-bank'))).toBeUndefined();
    });

    it('never generates any directive for an UNKNOWN provider account', async () => {
        db.prepare(`INSERT INTO accounts (id, provider, tax_character, account_type)
            VALUES ('acc-unknown', 'UNKNOWN', 'TAXABLE', 'BROKERAGE')`).run();
        db.prepare(`INSERT INTO accounts (id, provider, tax_character, account_type)
            VALUES ('acc-known', 'FIDELITY', 'TAXABLE', 'BROKERAGE')`).run();
        db.prepare(`INSERT INTO holdings (account_id, ticker, quantity, market_value, asset_type)
            VALUES ('acc-unknown', 'VTI', 200, 50000, 'EQUITY')`).run();
        db.prepare(`INSERT INTO holdings (account_id, ticker, quantity, market_value, asset_type)
            VALUES ('acc-known', 'VTI', 100, 20000, 'EQUITY')`).run();

        await generateDirectives();
        const directives = db.prepare('SELECT * FROM directives').all() as any[];
        expect(directives.find((d: any) => d.description.includes('acc-unknown'))).toBeUndefined();
    });

    // ── No cross-account pairing ────────────────────────────────────────────

    it('does not emit any directive for an account that has no cash and no overweight holdings', async () => {
        // THE OLD BUG: acc-deferred-empty would get a BUY just because its tax_character matched.
        // THE NEW INVARIANT: no cash → no DEPLOY_CASH; no holdings → no REBALANCE. Nothing.
        db.prepare(`INSERT INTO accounts (id, provider, tax_character, account_type)
            VALUES ('acc-roth-holds', 'FIDELITY', 'ROTH', 'ROTH_IRA')`).run();
        db.prepare(`INSERT INTO accounts (id, provider, tax_character, account_type)
            VALUES ('acc-deferred-empty', 'VANGUARD', 'DEFERRED', 'IRA')`).run();
        db.prepare(`INSERT INTO holdings (account_id, ticker, quantity, market_value, asset_type)
            VALUES ('acc-roth-holds', 'VTI', 100, 25000, 'EQUITY')`).run();
        // acc-deferred-empty: intentionally no holdings, no cash

        await generateDirectives();
        const directives = db.prepare('SELECT * FROM directives').all() as any[];
        expect(directives.find((d: any) => d.description.includes('acc-deferred-empty'))).toBeUndefined();
    });

    // ── Cash deployment ─────────────────────────────────────────────────────

    it('emits a BUY (Deploy) directive for an account with idle cash', async () => {
        // acc-roth-cash has $10k idle. REIT is underweight. ROTH preferred for REIT.
        // Pass 1: cash found → DEPLOY_CASH (type=BUY, description starts with "Deploy").
        db.prepare(`INSERT INTO accounts (id, provider, tax_character, account_type)
            VALUES ('acc-roth-cash', 'FIDELITY', 'ROTH', 'ROTH_IRA')`).run();
        db.prepare(`INSERT INTO holdings (account_id, ticker, quantity, market_value, asset_type)
            VALUES ('acc-roth-cash', 'CASH', 10000, 10000, 'EQUITY')`).run();

        await generateDirectives();
        const directives = db.prepare('SELECT * FROM directives').all() as any[];
        const deploy = directives.find((d: any) =>
            d.type === 'BUY' &&
            d.description.includes('acc-roth-cash') &&
            /deploy/i.test(d.description)
        );
        expect(deploy).toBeDefined();
    });
});
```

 - [x] **Step 2: Run tests — confirm they fail (or error) for the right reasons**

```bash
npx vitest run src/lib/logic/__tests__/rebalancer.test.ts --reporter=verbose
```

Expected: existing tests fail because current code emits `type='BUY'` not `'REBALANCE'`. New tests may pass or fail. All should run without crashing.

 - [x] **Step 3: Commit failing tests**

```bash
git add src/lib/logic/__tests__/rebalancer.test.ts
git commit -m "test: rebalancer account-aware behavior — 5 tests define new contract"
```

---

## Task 2: Rewrite `generateDirectives()`

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`

 - [x] **Step 1: Replace the entire file**

```typescript
// src/lib/logic/rebalancer.ts
//
// Generates rebalancing directives — three passes, all account-local:
//
//  Pass 1 — DEPLOY_CASH (type=BUY): account has idle cash → buy into underweight category
//  Pass 2 — REBALANCE: account holds overweight ticker AND is preferred venue for
//            an underweight category → swap within the same account
//  Pass 3 — SELL: overweight not addressed by Pass 2 → trim, hold proceeds
//            (Pass 1 will deploy on next cycle)
//
// INVARIANT: No directive ever pairs a sell in account A with a buy in account B.
// Money cannot move between accounts without explicit user action.

import db from '../db/client';
import { calculateHierarchicalMetrics, resolveValue } from './xray';
import { syncToMarkdown } from '../sync/markdown';
import { getTickerMap } from '../db/prices';
import { getPreferredTaxCharacter, AccountType } from './taxPlacement';

const MAX_TRANCHE_SIZE = 20000;
const MIN_TRANSACTION_SIZE = 500;
const MIN_IDLE_CASH = 1000;

// ── Types ────────────────────────────────────────────────────────────────────

interface AccountRow {
    id: string;
    provider: string;
    tax_character: string;
    account_type: string | null;
    nickname: string | null;
    allowed_tickers?: string;
}

export interface Directive {
    id?: number;
    type: 'SELL' | 'BUY' | 'REBALANCE';
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    reasoning: string;
    link_key: string;
    status?: string;
}

// Exposure of one account to one L2 category
interface CategoryExposure {
    ticker: string;            // ticker with the largest single-holding exposure (best to sell)
    value: number;             // total exposure across ALL tickers in this account for this label
    bestSingleExposure: number; // exposure of just `ticker` — needed to correctly track best sell candidate
}

interface AccountHoldings {
    accountId: string;
    totalValue: number;
    categoryExposure: Record<string, CategoryExposure>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formatted display name: "FIDELITY Rollover IRA".
 * If two accounts at the same provider share the same display name, appends
 * the last 4 chars of the account ID to disambiguate: "FIDELITY Rollover IRA (·1213)".
 */
function buildAccLabels(accounts: AccountRow[]): Map<string, string> {
    const labels = new Map<string, string>();
    const seen = new Map<string, string>(); // rawLabel → first account ID that produced it

    for (const acc of accounts) {
        const raw = `${acc.provider} ${(acc.nickname || acc.id)
            .split('(')[0].trim()
            .replace(/\s+Brokerage$/, '')
            .replace('IRA Brokerage', 'IRA')}`;

        if (!seen.has(raw)) {
            seen.set(raw, acc.id);
            labels.set(acc.id, raw);
        } else {
            // Disambiguate both accounts with last-4 suffix
            const firstId = seen.get(raw)!;
            labels.set(firstId, `${raw} (·${firstId.slice(-4)})`);
            labels.set(acc.id,  `${raw} (·${acc.id.slice(-4)})`);
        }
    }
    return labels;
}

/** Picks the best core ticker for a category, falls back to any matching ticker, then the label itself. */
function findBestTicker(label: string, tickerMap: ReturnType<typeof getTickerMap>): string {
    return (
        Object.entries(tickerMap).find(([, c]) => (c as any).is_core && (c.weights[label] || 0) > 0.8)?.[0] ||
        Object.entries(tickerMap).find(([, c]) => (c.weights[label] || 0) > 0.5)?.[0] ||
        label
    );
}

/** Cash and money-market balances per account. */
function getCashByAccount(): Record<string, number> {
    const rows = db.prepare(`
        SELECT account_id, SUM(COALESCE(market_value, quantity)) as cash
        FROM holdings
        WHERE ticker = 'CASH'
           OR ticker LIKE 'SPAXX%' OR ticker LIKE 'FDRXX%'
           OR ticker LIKE 'VMFXX%' OR ticker LIKE 'FZDXX%'
           OR ticker LIKE 'SPRXX%' OR ticker LIKE '%**%'
        GROUP BY account_id
    `).all() as { account_id: string; cash: number }[];
    return Object.fromEntries(rows.map(r => [r.account_id, r.cash]));
}

/**
 * Build per-account L2 category exposure by joining holdings × asset_registry.weights.
 *
 * For each (account, L2 label) pair:
 *   - `value` = total dollar exposure across ALL tickers in that account for that label
 *   - `ticker` = the ticker with the single largest exposure (best sell candidate)
 *   - `bestSingleExposure` = that ticker's individual exposure (tracked separately to
 *      avoid the off-by-one bug of comparing against the already-incremented total)
 */
function buildAccountHoldings(
    accounts: AccountRow[],
    tickerMap: ReturnType<typeof getTickerMap>
): AccountHoldings[] {
    const holdingRows = db.prepare(`
        SELECT account_id, ticker, quantity, market_value
        FROM holdings
        WHERE ticker != 'CASH'
          AND ticker NOT LIKE 'SPAXX%' AND ticker NOT LIKE 'FDRXX%'
          AND ticker NOT LIKE 'VMFXX%' AND ticker NOT LIKE 'FZDXX%'
          AND ticker NOT LIKE 'SPRXX%' AND ticker NOT LIKE '%**%'
    `).all() as { account_id: string; ticker: string; quantity: number; market_value: number | null }[];

    const byAccount = new Map<string, AccountHoldings>();
    for (const acc of accounts) {
        byAccount.set(acc.id, { accountId: acc.id, totalValue: 0, categoryExposure: {} });
    }

    for (const row of holdingRows) {
        const ah = byAccount.get(row.account_id);
        if (!ah) continue;

        const value = resolveValue(row.ticker, row.quantity, row.market_value) ?? 0;
        if (value <= 0) continue;
        ah.totalValue += value;

        const config = tickerMap[row.ticker];
        if (!config) continue;

        for (const [label, weight] of Object.entries(config.weights)) {
            const exposure = value * (weight as number);
            if (exposure <= 0) continue;

            const existing = ah.categoryExposure[label];
            if (!existing) {
                ah.categoryExposure[label] = { ticker: row.ticker, value: exposure, bestSingleExposure: exposure };
            } else {
                existing.value += exposure;
                // Update best sell candidate only when this ticker's individual exposure
                // exceeds the current best's individual exposure.
                // NOTE: do NOT compare against `existing.value` after incrementing — it now
                // includes this ticker's exposure, making the comparison incorrect.
                if (exposure > existing.bestSingleExposure) {
                    existing.ticker = row.ticker;
                    existing.bestSingleExposure = exposure;
                }
            }
        }
    }

    return Array.from(byAccount.values());
}

function priorityFor(driftDollars: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (driftDollars > 50000) return 'HIGH';
    if (driftDollars > 10000) return 'MEDIUM';
    return 'LOW';
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function generateDirectives(): Promise<number> {
    const metrics = calculateHierarchicalMetrics();
    const allAccounts = db.prepare('SELECT * FROM accounts').all() as AccountRow[];

    // Only investable accounts — exclude banking and unclassified imported rows
    const investable = allAccounts.filter(a =>
        a.account_type !== 'BANKING' &&
        a.provider !== 'UNKNOWN'
    );
    if (investable.length === 0) return 0;

    const tickerMap   = getTickerMap();
    const cashByAcc   = getCashByAccount();
    const accHoldings = buildAccountHoldings(investable, tickerMap);
    const holdingsMap = new Map(accHoldings.map(ah => [ah.accountId, ah]));
    const accLabels   = buildAccLabels(investable);

    const availableTypes = [...new Set(investable.map(a => a.tax_character as AccountType))];

    const totalPortfolioValue =
        accHoldings.reduce((s, ah) => s + ah.totalValue, 0) +
        Object.entries(cashByAcc)
            .filter(([id]) => investable.some(a => a.id === id))
            .reduce((s, [, v]) => s + v, 0);

    if (totalPortfolioValue === 0) {
        console.warn('rebalancer: portfolioValue is 0 — no priced holdings. Skipping directive generation.');
        return 0;
    }

    const overWeight  = metrics.filter(m => m.level === 2 && (m.actualPortfolio  - m.expectedPortfolio) > 0.02);
    const underWeight = metrics.filter(m => m.level === 2 && (m.expectedPortfolio - m.actualPortfolio)  > 0.02);

    const directives: Directive[] = [];
    const coveredOver  = new Set<string>();
    const coveredUnder = new Set<string>();

    // ── Pass 1: DEPLOY_CASH ───────────────────────────────────────────────
    // Account has idle cash → deploy into most underweight category matching this
    // account's tax character. Each underweight label is deployed into at most once.
    for (const acc of investable) {
        const cash = cashByAcc[acc.id] ?? 0;
        if (cash < MIN_IDLE_CASH) continue;

        const target = underWeight.find(m => {
            if (coveredUnder.has(m.label)) return false;
            return getPreferredTaxCharacter(m.label, availableTypes) === acc.tax_character;
        });
        if (!target) continue;

        const underDollar = (target.expectedPortfolio - target.actualPortfolio) * totalPortfolioValue;
        const amount = Math.min(cash, underDollar, MAX_TRANCHE_SIZE);
        if (amount < MIN_TRANSACTION_SIZE) continue;

        const bestBuy = findBestTicker(target.label, tickerMap);
        const label   = accLabels.get(acc.id)!;

        directives.push({
            type: 'BUY',
            description: `Deploy $${(amount / 1000).toFixed(1)}k cash → ${bestBuy} in ${label}`,
            priority: priorityFor(cash),
            reasoning: `$${(cash / 1000).toFixed(1)}k idle in ${label} · ${target.label} gap -${((target.expectedPortfolio - target.actualPortfolio) * 100).toFixed(1)}%`,
            link_key: target.label,
        });
        coveredUnder.add(target.label);
    }

    // ── Pass 2: REBALANCE (within-account swap) ───────────────────────────
    // For each account: if it holds an overweight ticker AND is the preferred venue
    // for an underweight category → swap both within the same account.
    for (const acc of investable) {
        const ah = holdingsMap.get(acc.id);
        if (!ah) continue;

        for (const over of overWeight) {
            if (coveredOver.has(over.label)) continue;

            const sellSide = ah.categoryExposure[over.label];
            if (!sellSide || sellSide.value < MIN_TRANSACTION_SIZE) continue;

            const under = underWeight.find(m => {
                if (coveredUnder.has(m.label)) return false;
                return getPreferredTaxCharacter(m.label, availableTypes) === acc.tax_character;
            });
            if (!under) continue;

            const overDollar  = (over.actualPortfolio  - over.expectedPortfolio)  * totalPortfolioValue;
            const underDollar = (under.expectedPortfolio - under.actualPortfolio) * totalPortfolioValue;
            const amount = Math.min(overDollar, underDollar, sellSide.value, MAX_TRANCHE_SIZE);
            if (amount < MIN_TRANSACTION_SIZE) continue;

            const bestBuy = findBestTicker(under.label, tickerMap);
            const label   = accLabels.get(acc.id)!;

            directives.push({
                type: 'REBALANCE',
                description: `Swap $${(amount / 1000).toFixed(1)}k ${sellSide.ticker} → ${bestBuy} in ${label}`,
                priority: priorityFor(Math.max(overDollar, underDollar)),
                reasoning: `${over.label} +${((over.actualPortfolio - over.expectedPortfolio) * 100).toFixed(1)}% over · ${under.label} -${((under.expectedPortfolio - under.actualPortfolio) * 100).toFixed(1)}% under in ${label}`,
                link_key: under.label,
            });

            coveredOver.add(over.label);
            coveredUnder.add(under.label);
        }
    }

    // ── Pass 3: STANDALONE TRIM ───────────────────────────────────────────
    // Overweight categories not addressed by a swap: trim the position,
    // hold proceeds. The next DEPLOY_CASH cycle will route them.
    for (const over of overWeight) {
        if (coveredOver.has(over.label)) continue;

        const overDollar = (over.actualPortfolio - over.expectedPortfolio) * totalPortfolioValue;
        if (overDollar < MIN_TRANSACTION_SIZE) continue;

        let bestAcc: AccountRow | null = null;
        let bestExposure: CategoryExposure | null = null;

        for (const acc of investable) {
            const ah = holdingsMap.get(acc.id);
            if (!ah) continue;
            const exposure = ah.categoryExposure[over.label];
            if (exposure && (!bestExposure || exposure.value > bestExposure.value)) {
                bestAcc = acc;
                bestExposure = exposure;
            }
        }

        if (!bestAcc || !bestExposure) continue;

        const amount = Math.min(overDollar, bestExposure.value, MAX_TRANCHE_SIZE);
        if (amount < MIN_TRANSACTION_SIZE) continue;

        const label = accLabels.get(bestAcc.id)!;

        directives.push({
            type: 'SELL',
            description: `Trim $${(amount / 1000).toFixed(1)}k ${bestExposure.ticker} in ${label} · hold proceeds`,
            priority: priorityFor(overDollar),
            reasoning: `${over.label} +${((over.actualPortfolio - over.expectedPortfolio) * 100).toFixed(1)}% overweight · proceeds stay as cash`,
            link_key: over.label,
        });
    }

    // ── Persist ───────────────────────────────────────────────────────────
    const insertDirective = db.prepare(`
        INSERT INTO directives (type, description, priority, status, reasoning, link_key)
        VALUES (?, ?, ?, 'PENDING', ?, ?)
    `);

    db.transaction(() => {
        db.prepare("DELETE FROM directives WHERE status = 'PENDING'").run();
        directives.forEach(d =>
            insertDirective.run(d.type, d.description, d.priority, d.reasoning, d.link_key)
        );
    })();

    // Snapshot portfolio value for performance tracking
    try {
        const { calculatePortfolioPerformance } = await import('./portfolioEngine');
        const perf = calculatePortfolioPerformance();
        if (perf.totalPortfolioValue > 0) {
            db.prepare(`
                INSERT INTO performance_snapshots (bucket, value, return_ytd, sharpe, sortino)
                VALUES ('CORE', ?, ?, ?, ?)
            `).run(perf.totalPortfolioValue, perf.return1y, perf.sharpe, perf.sortino);
        }
    } catch { /* non-fatal */ }

    syncToMarkdown();
    return directives.length;
}
```

 - [x] **Step 2: Run the rebalancer tests**

```bash
npx vitest run src/lib/logic/__tests__/rebalancer.test.ts --reporter=verbose
```

Expected: all 5 tests PASS.

 - [x] **Step 3: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass. Fix any failures before proceeding.

 - [x] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```

Expected: clean build, no TypeScript errors.

 - [x] **Step 5: Commit**

```bash
git add src/lib/logic/rebalancer.ts
git commit -m "feat: account-aware rebalancer — account-local directives only

Three-pass algorithm (DEPLOY_CASH → REBALANCE → SELL):
- DEPLOY_CASH: account has idle cash → BUY into underweight category
- REBALANCE: same account holds overweight AND is preferred venue for underweight
- SELL: overweight with no matching buy side → trim, hold proceeds

No cross-account directive pairing ever generated.
BANKING and UNKNOWN provider accounts excluded from all passes.
buildAccountHoldings: tracks bestSingleExposure separately to correctly
identify the best sell candidate when multiple tickers map to same L2 category."
```

---

## Task 3: Update TaskBlotter for REBALANCE type

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

The `REBALANCE` description already contains both legs ("Swap $Xk VTI → FSRNX in FIDELITY Rollover IRA"). The only change needed is a small visual indicator in the type badge so the user can distinguish a REBALANCE from a standalone BUY or SELL.

 - [x] **Step 1: Add a type color helper and update the directive card**

In `TaskBlotter.tsx`, find the directive card rendering block (around line 115) and add a type badge. The `type` field is already in the `Directive` interface:

```typescript
// Add this helper near the top of the component (after the imports, before TaskBlotter function)
function typeColor(type: string): string {
    if (type === 'REBALANCE') return 'text-blue-400';
    if (type === 'SELL')      return 'text-rose-400';
    return 'text-emerald-400'; // BUY / default
}
```

Then in the directive card (the `<div key={d.id}>` block), add the type badge before `d.description`:

```tsx
<p className="text-[11px] font-black text-zinc-100 leading-snug mb-2">
    <span className={`${typeColor(d.type)} mr-1 uppercase text-[9px] tracking-widest`}>
        {d.type}
    </span>
    {d.description}
</p>
```

 - [x] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

 - [x] **Step 3: Commit**

```bash
git add src/app/components/TaskBlotter.tsx
git commit -m "feat: TaskBlotter shows directive type badge (REBALANCE/BUY/SELL)"
```
