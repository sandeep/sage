# Rebalancer V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a `/rebalancer` page with account-grouped trade cards, done-gated tranche progression, and account-aware instrument resolution (already-held → allowlist → provider-match → default ETF).

**Architecture:** Extend the `directives` table with 5 new columns (`account_id`, `asset_class`, `scheduled_date`, `tranche_index`, `tranche_total`), update `generateReconciliationTrades` to split large positions into $20k tranches, add a new `instrumentResolver.ts` for D→C→B→DEFAULT lookup, then build the `/rebalancer` page as a Server Component with a single `RebalanceQueue` client component.

**Tech Stack:** Next.js 15 App Router, React Server Components, Server Actions, better-sqlite3, TypeScript, Tailwind CSS, Vitest.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/db/migrate.ts` | Modify | Add 5 columns to directives, create account_instrument_allowlist |
| `src/lib/db/__tests__/setup.ts` | Modify | Mirror new schema in test DB |
| `src/lib/logic/rebalancer.ts` | Modify | Extend Directive interface, update INSERT, preserve SCHEDULED on regen |
| `src/lib/logic/rebalance/frictionBridge.ts` | Modify | Split trades >$20k into tranches, populate account_id + asset_class |
| `src/lib/logic/instrumentResolver.ts` | Create | resolveInstrument(accountId, assetClass) → {ticker, tier, subtitle} |
| `src/lib/logic/__tests__/instrumentResolver.test.ts` | Create | Unit tests for resolver tiers |
| `src/app/api/directives/route.ts` | Modify | Accept SCHEDULED status + scheduled_date |
| `src/app/rebalancer/page.tsx` | Create | Server Component: auto-complete past-due scheduled, fetch + group directives |
| `src/app/rebalancer/RebalanceQueue.tsx` | Create | Client Component: AccountPanel + TradeCard with all state logic |
| `src/app/components/NavBar.tsx` | Modify | Add Rebalancer link |

---

## Task 1: Schema — extend directives + create allowlist table

**Files:**
- Modify: `src/lib/db/migrate.ts`
- Modify: `src/lib/db/__tests__/setup.ts`

- [x] **Step 1: Write the failing test**

Add to `src/lib/db/__tests__/setup.ts` — the directives table in `setupTestDb` needs the new columns. First verify the current setup doesn't have them:

```ts
// Add at the top of the existing directives section in setupTestDb's db.exec call:
// (this is just updating the CREATE TABLE statement — full replacement shown in Step 3)
```

Create `src/lib/logic/__tests__/schemaColumns.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';

describe('schema columns', () => {
    beforeEach(() => { setupTestDb(); });

    it('directives has account_id and tranche columns', () => {
        const cols = (db.prepare('PRAGMA table_info(directives)').all() as any[]).map(c => c.name);
        expect(cols).toContain('account_id');
        expect(cols).toContain('asset_class');
        expect(cols).toContain('scheduled_date');
        expect(cols).toContain('tranche_index');
        expect(cols).toContain('tranche_total');
    });

    it('account_instrument_allowlist table exists', () => {
        const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map(t => t.name);
        expect(tables).toContain('account_instrument_allowlist');
    });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd /Users/sandeep/Developer/sage2.0
npx vitest run src/lib/logic/__tests__/schemaColumns.test.ts
```

Expected: FAIL — columns not found.

- [x] **Step 3: Update setupTestDb to include new columns**

In `src/lib/db/__tests__/setup.ts`, replace the `CREATE TABLE IF NOT EXISTS directives` block (it doesn't currently exist — add it) and add the allowlist table. In `setupTestDb`'s `db.exec` call, add after the `holdings_ledger` block:

```ts
        CREATE TABLE IF NOT EXISTS directives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            description TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT NOT NULL,
            reasoning TEXT,
            link_key TEXT,
            account_id TEXT,
            asset_class TEXT,
            scheduled_date TEXT,
            tranche_index INTEGER NOT NULL DEFAULT 1,
            tranche_total INTEGER NOT NULL DEFAULT 1,
            executed_at DATETIME,
            final_value REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS account_instrument_allowlist (
            account_id TEXT NOT NULL,
            ticker TEXT NOT NULL,
            asset_class TEXT NOT NULL,
            added_at TEXT DEFAULT (date('now')),
            PRIMARY KEY (account_id, ticker)
        );
```

Also add to the `DELETE FROM` block:
```ts
        DELETE FROM directives;
        DELETE FROM account_instrument_allowlist;
```

- [x] **Step 4: Update migrate.ts**

In `src/lib/db/migrate.ts`, add after the existing `simulation_cache` block:

```ts
    // Directives V2 columns
    const directiveCols2 = db.prepare("PRAGMA table_info(directives)").all() as any[];
    if (!directiveCols2.find((c: any) => c.name === 'account_id')) {
        db.exec("ALTER TABLE directives ADD COLUMN account_id TEXT");
    }
    if (!directiveCols2.find((c: any) => c.name === 'asset_class')) {
        db.exec("ALTER TABLE directives ADD COLUMN asset_class TEXT");
    }
    if (!directiveCols2.find((c: any) => c.name === 'scheduled_date')) {
        db.exec("ALTER TABLE directives ADD COLUMN scheduled_date TEXT");
    }
    if (!directiveCols2.find((c: any) => c.name === 'tranche_index')) {
        db.exec("ALTER TABLE directives ADD COLUMN tranche_index INTEGER NOT NULL DEFAULT 1");
    }
    if (!directiveCols2.find((c: any) => c.name === 'tranche_total')) {
        db.exec("ALTER TABLE directives ADD COLUMN tranche_total INTEGER NOT NULL DEFAULT 1");
    }

    // Account instrument allowlist
    db.exec(`CREATE TABLE IF NOT EXISTS account_instrument_allowlist (
        account_id TEXT NOT NULL,
        ticker TEXT NOT NULL,
        asset_class TEXT NOT NULL,
        added_at TEXT DEFAULT (date('now')),
        PRIMARY KEY (account_id, ticker)
    )`);
```

- [x] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/lib/logic/__tests__/schemaColumns.test.ts
```

Expected: PASS — 2 tests.

- [x] **Step 6: Commit**

```bash
git add src/lib/db/migrate.ts src/lib/db/__tests__/setup.ts src/lib/logic/__tests__/schemaColumns.test.ts
git commit -m "feat(schema): add tranche + scheduling columns to directives, add account_instrument_allowlist"
```

---

## Task 2: Directive enrichment — tranching + new columns

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`
- Modify: `src/lib/logic/rebalance/frictionBridge.ts`

- [x] **Step 1: Write the failing test**

Create `src/lib/logic/__tests__/tranching.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';
import { generateReconciliationTrades } from '../rebalance/frictionBridge';

describe('tranche splitting', () => {
    beforeEach(() => { setupTestDb(); });

    it('splits a $50k buy into three $20k tranches', () => {
        const idealMap = { 'acc1': { 'VTI': 50000 } };
        const actualMap = { 'acc1': {} };
        const accountMeta = new Map([['acc1', { label: 'Test 401k', provider: 'VANGUARD' }]]);

        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'VANGUARD', 'DEFERRED')").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) VALUES ('VTI', 'Vanguard Total Market', '{\"Total Stock Market\":1.0}', 'ETF', 1)").run();

        const directives = generateReconciliationTrades(idealMap, actualMap, accountMeta);
        const vtiBuys = directives.filter(d => d.account_id === 'acc1' && d.asset_class === 'Total Stock Market');

        expect(vtiBuys.length).toBe(3);
        expect(vtiBuys[0].tranche_index).toBe(1);
        expect(vtiBuys[0].tranche_total).toBe(3);
        expect(vtiBuys[1].tranche_index).toBe(2);
        expect(vtiBuys[2].tranche_index).toBe(3);
        // Each tranche ≤ $20k
        vtiBuys.forEach(d => expect(d.amount!).toBeLessThanOrEqual(20000));
    });

    it('a $15k buy is a single tranche', () => {
        const idealMap = { 'acc1': { 'VTI': 15000 } };
        const actualMap = { 'acc1': {} };
        const accountMeta = new Map([['acc1', { label: 'Test 401k', provider: 'VANGUARD' }]]);

        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'VANGUARD', 'DEFERRED')").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) VALUES ('VTI', 'Vanguard Total Market', '{\"Total Stock Market\":1.0}', 'ETF', 1)").run();

        const directives = generateReconciliationTrades(idealMap, actualMap, accountMeta);
        const vtiBuys = directives.filter(d => d.account_id === 'acc1');

        expect(vtiBuys.length).toBe(1);
        expect(vtiBuys[0].tranche_total).toBe(1);
    });

    it('directives carry account_id and asset_class', () => {
        const idealMap = { 'acc1': { 'VTI': 10000 } };
        const actualMap = { 'acc1': {} };
        const accountMeta = new Map([['acc1', { label: 'Test 401k', provider: 'VANGUARD' }]]);

        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'VANGUARD', 'DEFERRED')").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) VALUES ('VTI', 'VTI', '{\"Total Stock Market\":1.0}', 'ETF', 1)").run();

        const directives = generateReconciliationTrades(idealMap, actualMap, accountMeta);
        expect(directives[0].account_id).toBe('acc1');
        expect(directives[0].asset_class).toBe('Total Stock Market');
    });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/logic/__tests__/tranching.test.ts
```

Expected: FAIL — `account_id` undefined, no tranche splitting.

- [x] **Step 3: Update the Directive interface in rebalancer.ts**

Replace the existing `Directive` interface (lines 11–19) with:

```ts
export interface Directive {
    id?: number;
    type: 'SELL' | 'BUY' | 'REBALANCE';
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    reasoning: string;
    link_key: string;
    status?: string;
    // V2 fields
    account_id?: string;
    asset_class?: string;
    scheduled_date?: string;
    tranche_index?: number;
    tranche_total?: number;
    amount?: number;  // raw dollar amount for display
}
```

- [x] **Step 4: Update INSERT statement and DELETE in rebalancer.ts**

Replace the `insertDirective` prepare call and the delete in `generateDirectives`:

```ts
    const insertDirective = db.prepare(`
        INSERT INTO directives (type, description, priority, status, reasoning, link_key, account_id, asset_class, tranche_index, tranche_total)
        VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
        // Only wipe PENDING — preserve SCHEDULED/EXECUTED/SNOOZED
        db.prepare("DELETE FROM directives WHERE status = 'PENDING'").run();
        directives.forEach(d =>
            insertDirective.run(
                d.type, d.description, d.priority, d.reasoning, d.link_key,
                d.account_id ?? null,
                d.asset_class ?? null,
                d.tranche_index ?? 1,
                d.tranche_total ?? 1
            )
        );
    })();
```

- [x] **Step 5: Update frictionBridge.ts — add tranche splitting + new fields**

Replace the entire file `src/lib/logic/rebalance/frictionBridge.ts`:

```ts
import { IdealPortfolioMap } from './idealMap';
import { Directive, resolveTickerForCategory } from '../rebalancer';
import db from '../../db/client';

export interface ActualHoldingsMap {
    [accountId: string]: {
        [ticker: string]: {
            quantity: number;
            value: number;
        }
    }
}

const MAX_TRANCHE_SIZE = 20000;

function resolveCategoryForTicker(ticker: string): string {
    const asset = db.prepare("SELECT weights FROM asset_registry WHERE ticker = ?").get(ticker) as { weights: string } | undefined;
    if (!asset) return ticker;
    try {
        const weights = JSON.parse(asset.weights);
        const categories = Object.keys(weights);
        return categories.length > 0 ? categories[0] : ticker;
    } catch {
        return ticker;
    }
}

function splitIntoTranches(directive: Omit<Directive, 'tranche_index' | 'tranche_total'>, totalAmount: number): Directive[] {
    const count = Math.ceil(totalAmount / MAX_TRANCHE_SIZE);
    const baseAmount = Math.floor(totalAmount / count);
    const remainder = totalAmount - baseAmount * count;

    return Array.from({ length: count }, (_, i) => {
        const amount = baseAmount + (i === count - 1 ? remainder : 0);
        const amountK = (amount / 1000).toFixed(1);
        const description = directive.description.replace(/\$[\d.]+k/, `$${amountK}k`);
        return {
            ...directive,
            description,
            amount,
            tranche_index: i + 1,
            tranche_total: count,
        };
    });
}

export function generateReconciliationTrades(
    idealMap: IdealPortfolioMap,
    actualMap: ActualHoldingsMap,
    accountMeta: Map<string, { label: string; provider: string }>
): Directive[] {
    const directives: Directive[] = [];
    const MIN_TRADE_SIZE = 1000;

    for (const [accountId, idealHoldings] of Object.entries(idealMap)) {
        const actualHoldings = actualMap[accountId] || {};
        const meta = accountMeta.get(accountId) || { label: accountId, provider: 'UNKNOWN' };

        const overweights: { ticker: string; amount: number }[] = [];
        const underweights: { ticker: string; amount: number }[] = [];

        const allTickers = new Set([...Object.keys(idealHoldings), ...Object.keys(actualHoldings)]);

        for (const ticker of allTickers) {
            const ideal = idealHoldings[ticker] || 0;
            const actual = actualHoldings[ticker]?.value || 0;
            const delta = actual - ideal;

            if (delta > MIN_TRADE_SIZE) {
                overweights.push({ ticker, amount: delta });
            } else if (delta < -MIN_TRADE_SIZE) {
                underweights.push({ ticker, amount: Math.abs(delta) });
            }
        }

        // Internal Swaps
        while (overweights.length > 0 && underweights.length > 0) {
            const over = overweights[0];
            const under = underweights[0];
            const swapAmount = Math.min(over.amount, under.amount);
            const category = resolveCategoryForTicker(under.ticker);
            const targetTicker = resolveTickerForCategory(category, meta.provider);

            const base: Omit<Directive, 'tranche_index' | 'tranche_total'> = {
                type: 'REBALANCE',
                description: `Swap $${(swapAmount / 1000).toFixed(1)}k ${over.ticker} → ${category} (${targetTicker}) in ${meta.label}`,
                priority: swapAmount > 10000 ? 'HIGH' : 'MEDIUM',
                reasoning: `Internal account reconciliation: trimming excess ${over.ticker} to fund missing ${category} in ${meta.label}`,
                link_key: targetTicker,
                account_id: accountId,
                asset_class: category,
                amount: swapAmount,
            };
            directives.push(...splitIntoTranches(base, swapAmount));

            over.amount -= swapAmount;
            under.amount -= swapAmount;
            if (over.amount < MIN_TRADE_SIZE) overweights.shift();
            if (under.amount < MIN_TRADE_SIZE) underweights.shift();
        }

        // Stand-alone Trims
        for (const over of overweights) {
            const base: Omit<Directive, 'tranche_index' | 'tranche_total'> = {
                type: 'SELL',
                description: `Trim $${(over.amount / 1000).toFixed(1)}k ${over.ticker} in ${meta.label}`,
                priority: over.amount > 10000 ? 'HIGH' : 'LOW',
                reasoning: `Overweight position in ${meta.label} relative to target-state blueprint.`,
                link_key: over.ticker,
                account_id: accountId,
                asset_class: resolveCategoryForTicker(over.ticker),
                amount: over.amount,
            };
            directives.push(...splitIntoTranches(base, over.amount));
        }

        // Stand-alone Buys
        for (const under of underweights) {
            const category = resolveCategoryForTicker(under.ticker);
            const targetTicker = resolveTickerForCategory(category, meta.provider);
            const base: Omit<Directive, 'tranche_index' | 'tranche_total'> = {
                type: 'BUY',
                description: `Buy $${(under.amount / 1000).toFixed(1)}k ${category} (${targetTicker}) in ${meta.label}`,
                priority: under.amount > 10000 ? 'HIGH' : 'LOW',
                reasoning: `Underweight position in ${meta.label} relative to target-state blueprint.`,
                link_key: targetTicker,
                account_id: accountId,
                asset_class: category,
                amount: under.amount,
            };
            directives.push(...splitIntoTranches(base, under.amount));
        }
    }

    return directives;
}
```

- [x] **Step 6: Run tests**

```bash
npx vitest run src/lib/logic/__tests__/tranching.test.ts
```

Expected: PASS — 3 tests.

Also run the existing frictionBridge test to make sure nothing regressed:

```bash
npx vitest run src/lib/logic/rebalance/__tests__/frictionBridge.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/lib/logic/rebalancer.ts src/lib/logic/rebalance/frictionBridge.ts src/lib/logic/__tests__/tranching.test.ts
git commit -m "feat(rebalancer): add account_id/asset_class/tranche fields, split >$20k positions into tranches"
```

---

## Task 3: Instrument resolver

**Files:**
- Create: `src/lib/logic/instrumentResolver.ts`
- Create: `src/lib/logic/__tests__/instrumentResolver.test.ts`

- [x] **Step 1: Write the failing test**

Create `src/lib/logic/__tests__/instrumentResolver.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';
import { resolveInstrument } from '../instrumentResolver';

describe('resolveInstrument', () => {
    beforeEach(() => {
        setupTestDb();
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-v', 'VANGUARD', 'DEFERRED')").run();
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-f', 'FIDELITY', 'ROTH')").run();
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-s', 'SCHWAB', 'TAXABLE')").run();
    });

    it('Tier D: returns already-held ticker when account holds it', () => {
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) VALUES ('VIIIX', 'Vanguard Institutional', '{\"Total Stock Market\":1.0}', 'FUND', 1)").run();
        db.prepare("INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type) VALUES ('2026-01-01', 'acc-v', 'VIIIX', 100, 'FUND')").run();

        const result = resolveInstrument('acc-v', 'Total Stock Market');
        expect(result.ticker).toBe('VIIIX');
        expect(result.tier).toBe('D');
        expect(result.subtitle).toContain('already in this account');
    });

    it('Tier C: returns allowlist ticker when no holding but allowlist entry exists', () => {
        db.prepare("INSERT INTO account_instrument_allowlist (account_id, ticker, asset_class) VALUES ('acc-f', 'FZROX', 'Total Stock Market')").run();

        const result = resolveInstrument('acc-f', 'Total Stock Market');
        expect(result.ticker).toBe('FZROX');
        expect(result.tier).toBe('C');
        expect(result.subtitle).toContain('on your list');
    });

    it('Tier B: returns provider-matched ticker for Vanguard account with no holding', () => {
        const result = resolveInstrument('acc-v', 'Total Stock Market');
        expect(result.ticker).toBe('VIIIX');
        expect(result.tier).toBe('B');
        expect(result.subtitle).toContain('Vanguard');
    });

    it('Tier B: returns provider-matched ticker for Fidelity', () => {
        const result = resolveInstrument('acc-f', 'Total Stock Market');
        expect(result.ticker).toBe('FZROX');
        expect(result.tier).toBe('B');
    });

    it('Tier DEFAULT: returns ETF_PROXY_MAP ticker when no provider match', () => {
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-u', 'UNKNOWN', 'TAXABLE')").run();
        const result = resolveInstrument('acc-u', 'Total Stock Market');
        expect(result.ticker).toBeTruthy();
        expect(result.tier).toBe('DEFAULT');
        expect(result.subtitle).toContain('best available');
    });

    it('falls back gracefully when assetClass is unknown', () => {
        const result = resolveInstrument('acc-v', 'Unicorn Asset');
        expect(result.ticker).toBe('Unicorn Asset');
        expect(result.tier).toBe('DEFAULT');
    });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/logic/__tests__/instrumentResolver.test.ts
```

Expected: FAIL — module not found.

- [x] **Step 3: Create instrumentResolver.ts**

Create `src/lib/logic/instrumentResolver.ts`:

```ts
import db from '../db/client';

export type ResolutionTier = 'D' | 'C' | 'B' | 'DEFAULT';

export interface InstrumentResolution {
    ticker: string;
    tier: ResolutionTier;
    subtitle: string;  // e.g. "Total Stock Market · already in this account"
}

// Tier B: provider-native funds. Lowest ER available at each platform.
const PROVIDER_MAP: Record<string, Record<string, string>> = {
    VANGUARD: {
        'Total Stock Market': 'VIIIX',
        'Small Cap Value': 'VSIAX',
        'US Aggregate Bond': 'VBTLX',
        'Developed Market': 'VTMGX',
        'Emerging Market': 'VEMAX',
        'REIT': 'VGSLX',
        'US Large Cap/SP500/DJIX': 'VIIIX',
    },
    FIDELITY: {
        'Total Stock Market': 'FZROX',
        'US Aggregate Bond': 'FXNAX',
        'Small Cap Value': 'FISVX',
        'Developed Market': 'FSPSX',
        'Emerging Market': 'FPADX',
        'US Large Cap/SP500/DJIX': 'FXAIX',
    },
    SCHWAB: {
        'Total Stock Market': 'SCHB',
        'US Aggregate Bond': 'SCHZ',
        'Small Cap Value': 'DFSVX',
        'Developed Market': 'SCHF',
        'Emerging Market': 'SCHE',
        'US Large Cap/SP500/DJIX': 'SCHX',
    },
};

// Tier DEFAULT: best generic ETF per class (used when no provider match)
const DEFAULT_MAP: Record<string, string> = {
    'Total Stock Market': 'VTI',
    'Small Cap Value': 'AVUV',
    'US Aggregate Bond': 'BND',
    'Developed Market': 'VEA',
    'Emerging Market': 'VWO',
    'REIT': 'VNQ',
    'US Large Cap/SP500/DJIX': 'VOO',
    'Cash': 'SGOV',
};

export function resolveInstrument(accountId: string, assetClass: string): InstrumentResolution {
    const account = db.prepare("SELECT provider FROM accounts WHERE id = ?").get(accountId) as { provider: string } | undefined;
    const provider = account?.provider ?? 'UNKNOWN';

    // Tier D: already held in this account, maps to this asset class
    const held = db.prepare(`
        SELECT hl.ticker FROM holdings_ledger hl
        JOIN asset_registry ar ON ar.ticker = hl.ticker
        WHERE hl.account_id = ?
          AND hl.snapshot_date = (SELECT MAX(snapshot_date) FROM holdings_ledger)
          AND ar.weights LIKE ?
        LIMIT 1
    `).get(accountId, `%"${assetClass}":%`) as { ticker: string } | undefined;

    if (held) {
        return {
            ticker: held.ticker,
            tier: 'D',
            subtitle: `${assetClass} · already in this account`,
        };
    }

    // Tier C: per-account allowlist
    const allowlisted = db.prepare(`
        SELECT ticker FROM account_instrument_allowlist
        WHERE account_id = ? AND asset_class = ?
        LIMIT 1
    `).get(accountId, assetClass) as { ticker: string } | undefined;

    if (allowlisted) {
        return {
            ticker: allowlisted.ticker,
            tier: 'C',
            subtitle: `${assetClass} · on your list for this account`,
        };
    }

    // Tier B: provider match
    const providerTicker = PROVIDER_MAP[provider]?.[assetClass];
    if (providerTicker) {
        const providerLabel = provider.charAt(0) + provider.slice(1).toLowerCase();
        return {
            ticker: providerTicker,
            tier: 'B',
            subtitle: `${assetClass} · ${providerLabel} fund — not yet held`,
        };
    }

    // Tier DEFAULT
    const defaultTicker = DEFAULT_MAP[assetClass] ?? assetClass;
    return {
        ticker: defaultTicker,
        tier: 'DEFAULT',
        subtitle: `${assetClass} · best available ETF — not yet held`,
    };
}
```

- [x] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/logic/__tests__/instrumentResolver.test.ts
```

Expected: PASS — 6 tests.

- [x] **Step 5: Commit**

```bash
git add src/lib/logic/instrumentResolver.ts src/lib/logic/__tests__/instrumentResolver.test.ts
git commit -m "feat(rebalancer): add instrument resolver with D/C/B/DEFAULT tier hierarchy"
```

---

## Task 4: Update directives API route to handle SCHEDULED

**Files:**
- Modify: `src/app/api/directives/route.ts`

- [x] **Step 1: Write the failing test**

Create `src/app/api/directives/__tests__/route.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db/client';
import { setupTestDb } from '@/lib/db/__tests__/setup';
import { POST } from '../route';

function makeRequest(body: object) {
    return new Request('http://localhost/api/directives', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('POST /api/directives', () => {
    beforeEach(() => {
        setupTestDb();
        db.prepare("INSERT INTO directives (id, type, description, priority, status, reasoning, link_key) VALUES (1, 'BUY', 'Buy VTI', 'HIGH', 'PENDING', 'test', 'VTI')").run();
    });

    it('accepts SCHEDULED status with a date', async () => {
        const req = makeRequest({ id: 1, status: 'SCHEDULED', scheduled_date: '2026-04-11' });
        const res = await POST(req as any);
        const body = await res.json();
        expect(body.success).toBe(true);

        const row = db.prepare("SELECT status, scheduled_date FROM directives WHERE id = 1").get() as any;
        expect(row.status).toBe('SCHEDULED');
        expect(row.scheduled_date).toBe('2026-04-11');
    });

    it('rejects SCHEDULED without a date', async () => {
        const req = makeRequest({ id: 1, status: 'SCHEDULED' });
        const res = await POST(req as any);
        expect(res.status).toBe(400);
    });

    it('accepts EXECUTED and sets executed_at', async () => {
        const req = makeRequest({ id: 1, status: 'EXECUTED' });
        const res = await POST(req as any);
        const body = await res.json();
        expect(body.success).toBe(true);

        const row = db.prepare("SELECT status, executed_at FROM directives WHERE id = 1").get() as any;
        expect(row.status).toBe('EXECUTED');
        expect(row.executed_at).toBeTruthy();
    });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/directives/__tests__/route.test.ts
```

Expected: FAIL — SCHEDULED not in valid statuses list.

- [x] **Step 3: Update route.ts**

Replace `src/app/api/directives/route.ts`:

```ts
import { NextResponse } from 'next/server';
import db from '@/lib/db/client';

const VALID_STATUSES = ['ACCEPTED', 'SNOOZED', 'EXECUTED', 'SCHEDULED'];

export async function POST(request: Request) {
    try {
        const { id, status, scheduled_date } = await request.json();

        if (!id || !VALID_STATUSES.includes(status)) {
            return NextResponse.json({ error: 'Invalid status update' }, { status: 400 });
        }

        if (status === 'SCHEDULED') {
            if (!scheduled_date || !/^\d{4}-\d{2}-\d{2}$/.test(scheduled_date)) {
                return NextResponse.json({ error: 'scheduled_date required (YYYY-MM-DD)' }, { status: 400 });
            }
            db.prepare("UPDATE directives SET status = 'SCHEDULED', scheduled_date = ? WHERE id = ?").run(scheduled_date, id);
        } else if (status === 'EXECUTED') {
            db.prepare("UPDATE directives SET status = 'EXECUTED', executed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
        } else {
            db.prepare("UPDATE directives SET status = ? WHERE id = ?").run(status, id);
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to update directive' }, { status: 500 });
    }
}
```

- [x] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/app/api/directives/__tests__/route.test.ts
```

Expected: PASS — 3 tests.

- [x] **Step 5: Commit**

```bash
git add src/app/api/directives/route.ts src/app/api/directives/__tests__/route.test.ts
git commit -m "feat(api): add SCHEDULED status to directives route with date validation"
```

---

## Task 5: Rebalancer page — Server Component

**Files:**
- Create: `src/app/rebalancer/page.tsx`

- [x] **Step 1: Write the page**

Create `src/app/rebalancer/page.tsx`:

```tsx
import db from '@/lib/db/client';
import { resolveInstrument } from '@/lib/logic/instrumentResolver';
import RebalanceQueue from './RebalanceQueue';

export const dynamic = 'force-dynamic';

export interface DirectiveRow {
    id: number;
    type: 'SELL' | 'BUY' | 'REBALANCE';
    description: string;
    priority: string;
    status: 'PENDING' | 'SCHEDULED' | 'SNOOZED' | 'EXECUTED' | 'ACCEPTED';
    reasoning: string;
    link_key: string;
    account_id: string | null;
    asset_class: string | null;
    scheduled_date: string | null;
    tranche_index: number;
    tranche_total: number;
    executed_at: string | null;
    created_at: string;
    // enriched
    resolvedTicker: string;
    resolvedSubtitle: string;
    amount: number;
    accountLabel: string;
    accountProvider: string;
    accountTaxChar: string;
    accountBalance: number;
}

function autoCompleteScheduled() {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`
        UPDATE directives
        SET status = 'EXECUTED', executed_at = CURRENT_TIMESTAMP
        WHERE status = 'SCHEDULED' AND scheduled_date <= ?
    `).run(today);
}

function parseAmount(description: string): number {
    const m = description.match(/\$([\d.]+)k/);
    return m ? parseFloat(m[1]) * 1000 : 0;
}

export default function RebalancerPage() {
    autoCompleteScheduled();

    const accounts = db.prepare("SELECT * FROM accounts WHERE account_type != 'BANKING' OR account_type IS NULL").all() as any[];
    const accountMap = new Map(accounts.map(a => [a.id, a]));

    // Balance per account
    const balances = new Map<string, number>();
    accounts.forEach(a => {
        const row = db.prepare("SELECT SUM(COALESCE(market_value, quantity)) as v FROM holdings WHERE account_id = ?").get(a.id) as any;
        balances.set(a.id, row?.v ?? 0);
    });

    const rows = db.prepare(`
        SELECT * FROM directives
        WHERE status IN ('PENDING', 'SCHEDULED', 'EXECUTED', 'ACCEPTED', 'SNOOZED')
        ORDER BY account_id, asset_class, tranche_index, created_at
    `).all() as any[];

    const enriched: DirectiveRow[] = rows.map(d => {
        const acc = accountMap.get(d.account_id ?? '');
        const resolution = d.account_id && d.asset_class
            ? resolveInstrument(d.account_id, d.asset_class)
            : { ticker: d.link_key ?? '', subtitle: d.asset_class ?? '', tier: 'DEFAULT' as const };

        return {
            ...d,
            resolvedTicker: resolution.ticker,
            resolvedSubtitle: resolution.subtitle,
            amount: parseAmount(d.description),
            accountLabel: acc ? `${acc.provider} ${acc.nickname ?? acc.id}` : (d.account_id ?? 'Unknown'),
            accountProvider: acc?.provider ?? '',
            accountTaxChar: acc?.tax_character ?? '',
            accountBalance: balances.get(d.account_id ?? '') ?? 0,
        };
    });

    // Group by account_id, maintaining account order
    const grouped = new Map<string, DirectiveRow[]>();
    enriched.forEach(d => {
        const key = d.account_id ?? '__unknown__';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(d);
    });

    return (
        <main className="max-w-[1400px] mx-auto px-10 py-10">
            <div className="mb-8 border-b border-zinc-900 pb-6">
                <h1 className="text-sm font-black uppercase tracking-widest text-zinc-100">Rebalance Queue</h1>
                <p className="text-xs text-zinc-600 mt-1">Execute at your brokerage · mark done after each trade</p>
            </div>
            <RebalanceQueue groups={Object.fromEntries(grouped)} />
        </main>
    );
}
```

- [x] **Step 2: Verify the page compiles (no test for RSC data fetching)**

```bash
cd /Users/sandeep/Developer/sage2.0
npx tsc --noEmit 2>&1 | grep rebalancer
```

Expected: no errors for the new file.

- [x] **Step 3: Commit**

```bash
git add src/app/rebalancer/page.tsx
git commit -m "feat(rebalancer): add server component page with auto-complete and instrument enrichment"
```

---

## Task 6: RebalanceQueue client component

**Files:**
- Create: `src/app/rebalancer/RebalanceQueue.tsx`

- [x] **Step 1: Create the component**

Create `src/app/rebalancer/RebalanceQueue.tsx`:

```tsx
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DirectiveRow } from './page';

// --- helpers ---

function isBuy(d: DirectiveRow) { return d.type === 'BUY' || d.type === 'REBALANCE'; }

function amountDisplay(d: DirectiveRow) {
    const sign = isBuy(d) ? '+' : '-';
    const k = (d.amount / 1000).toFixed(1);
    return `${sign}$${k}k`;
}

function isUnlocked(d: DirectiveRow, allInGroup: DirectiveRow[]): boolean {
    if (d.tranche_total === 1) return true;
    // All earlier tranches for same account+assetClass must be SCHEDULED or EXECUTED
    const siblings = allInGroup.filter(
        s => s.asset_class === d.asset_class && s.tranche_total > 1
    );
    const prior = siblings.filter(s => s.tranche_index < d.tranche_index);
    return prior.every(s => s.status === 'SCHEDULED' || s.status === 'EXECUTED');
}

function suggestedDate(d: DirectiveRow): string {
    const base = d.scheduled_date ?? new Date().toISOString().slice(0, 10);
    const dt = new Date(base);
    dt.setDate(dt.getDate() + 14);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --- API call ---

async function updateDirective(id: number, status: string, scheduled_date?: string) {
    await fetch('/api/directives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, scheduled_date }),
    });
}

// --- TradeCard ---

function TradeCard({ d, allInGroup, onRefresh }: {
    d: DirectiveRow;
    allInGroup: DirectiveRow[];
    onRefresh: () => void;
}) {
    const [scheduling, setScheduling] = useState(false);
    const [dateValue, setDateValue] = useState('');
    const [pending, startTransition] = useTransition();

    const unlocked = isUnlocked(d, allInGroup);
    const isDone = d.status === 'EXECUTED';
    const isScheduled = d.status === 'SCHEDULED';
    const isSnoozed = d.status === 'SNOOZED';

    const amountColor = isBuy(d) ? 'text-emerald-400' : 'text-rose-400';

    // DONE state
    if (isDone) {
        const doneDate = d.executed_at
            ? new Date(d.executed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : d.scheduled_date ?? '';
        return (
            <div className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2.5 opacity-35">
                <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[11px] font-black text-zinc-500 line-through">{d.type} {d.resolvedTicker}</span>
                    <span className="text-xs font-black text-zinc-600">{amountDisplay(d)} ✓</span>
                </div>
                <div className="text-[10px] text-zinc-700">{d.resolvedSubtitle} · done {doneDate}</div>
            </div>
        );
    }

    // LOCKED state (tranche not yet unlocked)
    if (!unlocked) {
        return (
            <div className="bg-zinc-950/50 border border-zinc-800 border-dashed rounded px-3 py-2.5 opacity-30">
                <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[11px] font-black text-zinc-600">{d.type} {d.resolvedTicker}</span>
                    <span className="text-xs font-black text-zinc-700">{amountDisplay(d)}</span>
                </div>
                <div className="text-[10px] text-zinc-700">
                    {d.resolvedSubtitle} · tranche {d.tranche_index} of {d.tranche_total} · locked
                </div>
            </div>
        );
    }

    // SCHEDULED state
    if (isScheduled) {
        const schedDate = d.scheduled_date
            ? new Date(d.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '';
        return (
            <div className="bg-zinc-950 border border-amber-900/40 rounded px-3 py-2.5">
                <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[11px] font-black text-zinc-100">{d.type} {d.resolvedTicker}</span>
                    <span className={`text-xs font-black ${amountColor}`}>{amountDisplay(d)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-500">{d.resolvedSubtitle}{d.tranche_total > 1 ? ` · tranche ${d.tranche_index} of ${d.tranche_total}` : ''}</span>
                    <span className="text-[10px] font-bold text-amber-500">SCHED {schedDate}</span>
                </div>
            </div>
        );
    }

    // SNOOZED state
    if (isSnoozed) {
        return (
            <div className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2.5 opacity-50">
                <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[11px] font-black text-zinc-400">{d.type} {d.resolvedTicker}</span>
                    <span className={`text-xs font-black text-zinc-500`}>{amountDisplay(d)}</span>
                </div>
                <div className="text-[10px] text-zinc-600">{d.resolvedSubtitle} · snoozed</div>
            </div>
        );
    }

    // OPEN state
    const trancheHint = d.tranche_total > 1
        ? ` · tranche ${d.tranche_index} of ${d.tranche_total}${d.tranche_index > 1 ? ` · suggested ${suggestedDate(d)}` : ''}`
        : '';

    return (
        <div className={`bg-zinc-950 border border-zinc-900 rounded px-3 py-2.5 ${pending ? 'opacity-40' : ''}`}>
            <div className="flex justify-between items-baseline mb-1">
                <span className="text-[11px] font-black text-zinc-100">{d.type} {d.resolvedTicker}</span>
                <span className={`text-xs font-black ${amountColor}`}>{amountDisplay(d)}</span>
            </div>
            <div className="text-[10px] text-zinc-500 mb-2.5">{d.resolvedSubtitle}{trancheHint}</div>

            {scheduling ? (
                <div className="flex gap-2 items-center">
                    <input
                        type="date"
                        value={dateValue}
                        onChange={e => setDateValue(e.target.value)}
                        className="text-[10px] bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 flex-1"
                    />
                    <button
                        disabled={!dateValue}
                        onClick={() => startTransition(async () => {
                            await updateDirective(d.id, 'SCHEDULED', dateValue);
                            setScheduling(false);
                            onRefresh();
                        })}
                        className="text-[9px] font-black text-amber-400 border border-amber-900 px-2 py-1 rounded disabled:opacity-30"
                    >
                        CONFIRM
                    </button>
                    <button
                        onClick={() => setScheduling(false)}
                        className="text-[9px] text-zinc-600 px-2 py-1"
                    >
                        ✕
                    </button>
                </div>
            ) : (
                <div className="flex gap-1.5">
                    <button
                        onClick={() => setScheduling(true)}
                        className="text-[9px] font-black text-amber-500 border border-amber-900/60 px-2 py-1 rounded hover:bg-amber-950/30 transition-colors"
                    >
                        SCHEDULE
                    </button>
                    <button
                        onClick={() => startTransition(async () => {
                            await updateDirective(d.id, 'EXECUTED');
                            onRefresh();
                        })}
                        className="text-[9px] font-black text-emerald-500 border border-emerald-900/60 px-2 py-1 rounded hover:bg-emerald-950/30 transition-colors"
                    >
                        DONE
                    </button>
                    <button
                        onClick={() => startTransition(async () => {
                            await updateDirective(d.id, 'SNOOZED');
                            onRefresh();
                        })}
                        className="text-[9px] text-zinc-600 border border-zinc-800 px-2 py-1 rounded hover:text-zinc-400 transition-colors"
                    >
                        SNOOZE
                    </button>
                </div>
            )}
        </div>
    );
}

// --- AccountPanel ---

function AccountPanel({ accountId, directives }: { accountId: string; directives: DirectiveRow[] }) {
    const router = useRouter();

    if (directives.length === 0) return null;

    const first = directives[0];
    const openCount = directives.filter(d => d.status === 'PENDING' || d.status === 'ACCEPTED').length;
    const scheduledCount = directives.filter(d => d.status === 'SCHEDULED').length;
    const isTaxable = first.accountTaxChar === 'TAXABLE';

    const statusLabel = scheduledCount > 0
        ? `${openCount} open · ${scheduledCount} scheduled`
        : openCount > 0
        ? `${openCount} open`
        : 'all done';

    const headerColor = isTaxable ? 'text-amber-500' : 'text-emerald-500';

    return (
        <div className="bg-zinc-950 border border-zinc-900 rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-900 flex justify-between items-center">
                <div>
                    <div className={`text-[10px] font-black uppercase tracking-widest ${headerColor}`}>
                        {first.accountLabel}
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                        {first.accountTaxChar} · ${(first.accountBalance / 1000).toFixed(0)}k
                    </div>
                </div>
                <div className={`text-[10px] font-bold ${isTaxable ? 'text-amber-600' : 'text-zinc-600'}`}>
                    {isTaxable ? '⚠ tax-sensitive · ' : ''}{statusLabel}
                </div>
            </div>

            <div className="p-3 flex flex-col gap-2">
                {directives.map(d => (
                    <TradeCard
                        key={d.id}
                        d={d}
                        allInGroup={directives}
                        onRefresh={() => router.refresh()}
                    />
                ))}
            </div>
        </div>
    );
}

// --- RebalanceQueue ---

export default function RebalanceQueue({ groups }: { groups: Record<string, DirectiveRow[]> }) {
    const accountIds = Object.keys(groups);

    if (accountIds.length === 0) {
        return (
            <div className="py-20 text-center border border-zinc-900 rounded border-dashed">
                <div className="text-xs text-zinc-700 italic">No rebalancing needed. Portfolio is in equilibrium.</div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {accountIds.map(id => (
                <AccountPanel key={id} accountId={id} directives={groups[id]} />
            ))}
        </div>
    );
}
```

- [x] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep rebalancer
```

Expected: no errors.

- [x] **Step 3: Start dev server and navigate to /rebalancer**

```bash
PORT=3005 npm run dev
```

Open `http://localhost:3005/rebalancer`. Verify:
- Account panels render grouped by account
- Each trade card shows ticker, amount, subtitle
- Clicking SCHEDULE shows date input; entering a date and confirming marks it amber "SCHED Apr 11"
- Clicking DONE strikes through the card
- Clicking SNOOZE fades the card
- For tranched positions, later tranches are locked (dashed) until prior one is SCHEDULED or DONE

- [x] **Step 4: Commit**

```bash
git add src/app/rebalancer/RebalanceQueue.tsx
git commit -m "feat(rebalancer): add RebalanceQueue client component with account panels, tranche gating, and schedule flow"
```

---

## Task 7: Add Rebalancer to NavBar

**Files:**
- Modify: `src/app/components/NavBar.tsx`

- [x] **Step 1: Add nav item**

In `src/app/components/NavBar.tsx`, update the `NAV_ITEMS` array to include Rebalancer between Accounts and Holdings:

```ts
const NAV_ITEMS = [
    { href: '/',                  label: 'Dashboard'  },
    { href: '/performance',       label: 'Performance'},
    { href: '/accounts',          label: 'Accounts'   },
    { href: '/rebalancer',        label: 'Rebalancer' },
    { href: '/holdings',          label: 'Holdings'   },
    { href: '/admin/snapshots',   label: 'Snapshots'  },
    { href: '/admin/allocation',  label: 'Allocation' },
];
```

- [x] **Step 2: Verify in browser**

Reload `http://localhost:3005`. Confirm "Rebalancer" appears in the nav and highlights when on `/rebalancer`.

- [x] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all existing tests pass plus the new ones (schemaColumns, tranching, instrumentResolver, route).

- [x] **Step 4: Commit**

```bash
git add src/app/components/NavBar.tsx
git commit -m "feat(nav): add Rebalancer link between Accounts and Holdings"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| `/rebalancer` page, account panels | Task 5, 6 |
| Instrument resolution D→C→B→DEFAULT | Task 3 |
| SCHEDULE + settlement date | Task 4, 6 |
| Done-gated tranche progression | Task 6 (`isUnlocked`) |
| Auto-complete on date pass | Task 5 (`autoCompleteScheduled`) |
| Suggested date when tranche unlocks | Task 6 (`suggestedDate`) |
| `account_instrument_allowlist` table | Task 1 |
| NavBar link | Task 7 |
| SNOOZED doesn't unlock tranches | Task 6 (`isUnlocked` excludes SNOOZED) |
| $20k tranche splitting | Task 2 |
| `account_id` + `asset_class` on directives | Task 2 |

All requirements covered.
