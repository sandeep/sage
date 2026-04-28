# Tax-Efficient Fund Placement Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Replace the 3-line string-matching hack in the rebalancer's BUY venue logic with a principled, auditable tax placement config, and fix the efficiency module to identify tax-inefficient holdings via `asset_registry` rather than a hardcoded ticker list.

**Architecture:** One new module (`taxPlacement.ts`) holds the static config: allocation label → preferred account type priority order. The rebalancer imports `getPreferredTaxCharacter(label)` instead of its current string-match. The efficiency module gets a targeted query fix — no new module needed. No DB changes required; tax placement rules are law-derived, not user-configurable, and belong in version-controlled code.

**Reference:** Bogleheads tax-efficient fund placement guide (pasted in session). Key principle: "Least tax-efficient assets fill tax-advantaged accounts first; fallback order is DEFERRED → ROTH → TAXABLE for inefficient assets, TAXABLE → ROTH → DEFERRED for efficient ones."

**Tech Stack:** Next.js 15, TypeScript, better-sqlite3, Vitest.

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/lib/logic/taxPlacement.ts` | Create | Static config: allocation label → `AccountType[]` priority order + tax efficiency tier |
| `src/lib/logic/__tests__/taxPlacement.test.ts` | Create | Unit tests for `getPreferredTaxCharacter` and `getTaxEfficiencyTier` |
| `src/lib/logic/rebalancer.ts` | Modify | Replace string-match venue logic with `getPreferredTaxCharacter()` |
| `src/lib/logic/efficiency.ts` | Modify | Replace hardcoded ticker list with `asset_registry`-based classification |

---

## Chunk 1: Tax Placement Config Module

### Task 1: Write taxPlacement.ts with failing tests

**Files:**
- Create: `src/lib/logic/__tests__/taxPlacement.test.ts`
- Create: `src/lib/logic/taxPlacement.ts`

**Context:** The allocation labels come from `ETF_PROXY_MAP` in `allocationSimulator.ts`. All known labels at time of writing:
- Efficient (TAXABLE first): `'Total Stock Market'`, `'US Large Cap/SP500/DJIX'`, `'Developed Market'`, `'Emerging Market'`
- Moderately inefficient (DEFERRED first): `'Small Cap Value'`, `'Small-Cap'`, `'Mid-Cap'`
- Very inefficient (ROTH first, then DEFERRED): `'REIT'`
- Bond (DEFERRED first): `'US Aggregate Bond'`
- Cash (TAXABLE only, no preference): `'Cash'`

REIT gets ROTH priority over DEFERRED because REIT distributions (non-qualified dividends + return of capital) don't benefit from ordinary-income deferral the way bonds do — tax-free growth in ROTH is strictly superior.

 - [x] **Step 1: Write failing tests**

Create `src/lib/logic/__tests__/taxPlacement.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getPreferredTaxCharacter, getTaxEfficiencyTier, PLACEMENT_PRIORITY } from '../taxPlacement';

describe('getTaxEfficiencyTier', () => {
    it('marks total stock market as efficient', () => {
        expect(getTaxEfficiencyTier('Total Stock Market')).toBe('efficient');
    });
    it('marks international as efficient (foreign tax credit)', () => {
        expect(getTaxEfficiencyTier('Developed Market')).toBe('efficient');
        expect(getTaxEfficiencyTier('Emerging Market')).toBe('efficient');
    });
    it('marks small cap value as moderately_inefficient', () => {
        expect(getTaxEfficiencyTier('Small Cap Value')).toBe('moderately_inefficient');
    });
    it('marks REIT as very_inefficient', () => {
        expect(getTaxEfficiencyTier('REIT')).toBe('very_inefficient');
    });
    it('marks bonds as inefficient', () => {
        expect(getTaxEfficiencyTier('US Aggregate Bond')).toBe('inefficient');
    });
    it('defaults unknown labels to efficient (place anywhere)', () => {
        expect(getTaxEfficiencyTier('Unknown Asset Class')).toBe('efficient');
    });
});

describe('getPreferredTaxCharacter', () => {
    it('returns TAXABLE first for efficient assets', () => {
        expect(getPreferredTaxCharacter('Total Stock Market', ['TAXABLE', 'DEFERRED', 'ROTH'])).toBe('TAXABLE');
    });
    it('returns DEFERRED first for bond funds', () => {
        expect(getPreferredTaxCharacter('US Aggregate Bond', ['TAXABLE', 'DEFERRED', 'ROTH'])).toBe('DEFERRED');
    });
    it('returns ROTH first for REIT (prefer tax-free over tax-deferred for non-qualified income)', () => {
        expect(getPreferredTaxCharacter('REIT', ['TAXABLE', 'DEFERRED', 'ROTH'])).toBe('ROTH');
    });
    it('falls back to DEFERRED for REIT when ROTH unavailable', () => {
        expect(getPreferredTaxCharacter('REIT', ['TAXABLE', 'DEFERRED'])).toBe('DEFERRED');
    });
    it('falls back to DEFERRED for bonds when DEFERRED unavailable → ROTH', () => {
        expect(getPreferredTaxCharacter('US Aggregate Bond', ['TAXABLE', 'ROTH'])).toBe('ROTH');
    });
    it('falls back to TAXABLE when no preferred account type is available', () => {
        expect(getPreferredTaxCharacter('US Aggregate Bond', ['TAXABLE'])).toBe('TAXABLE');
    });
    it('returns DEFERRED first for small cap value (moderately inefficient)', () => {
        expect(getPreferredTaxCharacter('Small Cap Value', ['TAXABLE', 'DEFERRED', 'ROTH'])).toBe('DEFERRED');
    });
});

describe('PLACEMENT_PRIORITY', () => {
    it('has an entry for every known allocation label', () => {
        const knownLabels = [
            'Total Stock Market', 'US Large Cap/SP500/DJIX', 'Small Cap Value',
            'REIT', 'Mid-Cap', 'Small-Cap', 'Developed Market', 'Emerging Market',
            'US Aggregate Bond',
        ];
        knownLabels.forEach(label => {
            expect(PLACEMENT_PRIORITY[label]).toBeDefined();
            expect(PLACEMENT_PRIORITY[label].length).toBeGreaterThan(0);
        });
    });
});
```

 - [x] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/lib/logic/__tests__/taxPlacement.test.ts
```
Expected: FAIL (module does not exist)

 - [x] **Step 3: Implement taxPlacement.ts**

Create `src/lib/logic/taxPlacement.ts`:

```typescript
// src/lib/logic/taxPlacement.ts
//
// Tax-efficient fund placement rules.
// Source: Bogleheads tax-efficient fund placement guide.
//
// Key principles:
//   - Very inefficient (REIT): ROTH > DEFERRED > TAXABLE
//     REIT income is non-qualified; tax-free growth beats deferral.
//   - Inefficient (bonds): DEFERRED > ROTH > TAXABLE
//     Bond interest is ordinary income — defer it.
//   - Moderately inefficient (small cap value, mid/small cap): DEFERRED > ROTH > TAXABLE
//     Higher yields + lower qualified dividend fraction than large-cap blend.
//   - Efficient (total market, large cap, international): TAXABLE > ROTH > DEFERRED
//     Low dividends mostly qualified; capital gains deferred until sale.
//     International gets foreign tax credit only in taxable accounts.
//
// Update this file when tax law changes warrant it. Changes are tracked in git.

export type AccountType = 'TAXABLE' | 'DEFERRED' | 'ROTH';
export type TaxEfficiencyTier = 'efficient' | 'moderately_inefficient' | 'inefficient' | 'very_inefficient';

interface PlacementRule {
    priority: AccountType[];   // preferred order; first available account type wins
    tier: TaxEfficiencyTier;
}

// Maps allocation leaf labels (from allocation_nodes.label) to placement rules.
// Labels must match exactly — they are the primary key across the system.
export const PLACEMENT_PRIORITY: Record<string, PlacementRule> = {
    // ── Very tax-inefficient ─────────────────────────────────────────────────
    'REIT': {
        priority: ['ROTH', 'DEFERRED', 'TAXABLE'],
        tier: 'very_inefficient',
    },

    // ── Tax-inefficient (bonds) ──────────────────────────────────────────────
    'US Aggregate Bond': {
        priority: ['DEFERRED', 'ROTH', 'TAXABLE'],
        tier: 'inefficient',
    },

    // ── Moderately inefficient ───────────────────────────────────────────────
    // Higher yields and/or lower qualified dividend fraction vs large-cap blend.
    'Small Cap Value': {
        priority: ['DEFERRED', 'ROTH', 'TAXABLE'],
        tier: 'moderately_inefficient',
    },
    'Small-Cap': {
        priority: ['DEFERRED', 'ROTH', 'TAXABLE'],
        tier: 'moderately_inefficient',
    },
    'Mid-Cap': {
        priority: ['DEFERRED', 'ROTH', 'TAXABLE'],
        tier: 'moderately_inefficient',
    },

    // ── Efficient ────────────────────────────────────────────────────────────
    // International: foreign tax credit available only in taxable accounts.
    'Developed Market': {
        priority: ['TAXABLE', 'ROTH', 'DEFERRED'],
        tier: 'efficient',
    },
    'Emerging Market': {
        priority: ['TAXABLE', 'ROTH', 'DEFERRED'],
        tier: 'efficient',
    },
    // Broad market + large cap: low yield, mostly qualified dividends, gains deferred.
    'Total Stock Market': {
        priority: ['TAXABLE', 'ROTH', 'DEFERRED'],
        tier: 'efficient',
    },
    'US Large Cap/SP500/DJIX': {
        priority: ['TAXABLE', 'ROTH', 'DEFERRED'],
        tier: 'efficient',
    },
};

// Default for unknown labels: treat as efficient (place anywhere).
const DEFAULT_RULE: PlacementRule = {
    priority: ['TAXABLE', 'ROTH', 'DEFERRED'],
    tier: 'efficient',
};

/** Returns the tax efficiency tier for a given allocation label. */
export function getTaxEfficiencyTier(label: string): TaxEfficiencyTier {
    return (PLACEMENT_PRIORITY[label] ?? DEFAULT_RULE).tier;
}

/**
 * Returns the best available account type for a given allocation label,
 * given the set of account types actually present in the portfolio.
 *
 * @param label - Allocation leaf label (e.g. 'REIT', 'US Aggregate Bond')
 * @param availableTypes - Account types present (e.g. ['TAXABLE', 'DEFERRED'])
 */
export function getPreferredTaxCharacter(
    label: string,
    availableTypes: AccountType[]
): AccountType {
    const rule = PLACEMENT_PRIORITY[label] ?? DEFAULT_RULE;
    for (const preferred of rule.priority) {
        if (availableTypes.includes(preferred)) return preferred;
    }
    // Guaranteed fallback: availableTypes always has at least one entry.
    return availableTypes[0];
}
```

 - [x] **Step 4: Run tests — expect all pass**

```bash
npx vitest run src/lib/logic/__tests__/taxPlacement.test.ts
```
Expected: all PASS

 - [x] **Step 5: Run full suite**

```bash
npx vitest run
```
Expected: all PASS

 - [x] **Step 6: Commit**

```bash
git add src/lib/logic/taxPlacement.ts src/lib/logic/__tests__/taxPlacement.test.ts
git commit -m "feat: add taxPlacement module with Bogleheads-derived placement rules for all allocation labels"
```

---

## Chunk 2: Wire Tax Placement into Rebalancer

### Task 2: Replace string-match BUY venue logic with taxPlacement

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`

**Context:** The current BUY venue selection (lines ~117-119) is:
```typescript
let targetTaxCharacter = 'TAXABLE';
if (m.label.includes('Bond') || m.label.includes('REIT')) targetTaxCharacter = 'DEFERRED';
if (m.label.includes('Large Cap')) targetTaxCharacter = 'ROTH';
```
Problems: only matches substring patterns, wrong for REIT (should prefer ROTH not DEFERRED), wrong for international (misses foreign tax credit → TAXABLE), hardcoded and fragile. The same logic appears in the idle-cash deployment section (~line 187).

 - [x] **Step 1: Add import**

At the top of `src/lib/logic/rebalancer.ts`, add:
```typescript
import { getPreferredTaxCharacter, AccountType } from './taxPlacement';
```

 - [x] **Step 2: Build availableTypes once**

Place this **after** the early-return guard at line ~49 (`if (accounts.length === 0) return 0`), not at the accounts declaration:
```typescript
if (accounts.length === 0) return 0;

const availableTypes = [...new Set(accounts.map(a => a.tax_character as AccountType))];
```

 - [x] **Step 3: Replace BUY venue string-match**

Find (lines ~117-119):
```typescript
        let targetTaxCharacter = 'TAXABLE';
        if (m.label.includes('Bond') || m.label.includes('REIT')) targetTaxCharacter = 'DEFERRED';
        if (m.label.includes('Large Cap')) targetTaxCharacter = 'ROTH';
```

Replace with:
```typescript
        const targetTaxCharacter = getPreferredTaxCharacter(m.label, availableTypes);
```

 - [x] **Step 4: Replace idle-cash string-match**

Find (lines ~186-189):
```typescript
            let preferred = 'TAXABLE';
            if (m.label.includes('Bond') || m.label.includes('REIT')) preferred = 'DEFERRED';
            if (m.label.includes('Large Cap')) preferred = 'ROTH';
            return account.tax_character === preferred;
```

Replace with:
```typescript
            const preferred = getPreferredTaxCharacter(m.label, availableTypes);
            return account.tax_character === preferred;
```

 - [x] **Step 5: Add integration test for REIT→ROTH routing**

The key behavioral change in this plan is that REIT now prefers ROTH over DEFERRED. The existing rebalancer test only seeds a DEFERRED account, so it can't catch a regression where REIT goes to the wrong account. Add this test to `src/lib/logic/__tests__/rebalancer.test.ts`:

```typescript
it('routes REIT BUY directive to ROTH when both ROTH and DEFERRED accounts exist', async () => {
    // Seed two accounts
    db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-roth', 'FIDELITY', 'ROTH')").run();
    db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-deferred', 'FIDELITY', 'DEFERRED')").run();
    // Seed a REIT underweight — REIT expected 10%, actual 0%
    // (seed allocation_nodes with REIT weight and no matching holdings)
    // ... adapt to match the test file's existing setup pattern ...
    await generateDirectives();
    const directives = db.prepare("SELECT * FROM directives").all() as any[];
    const reitBuy = directives.find(d => d.link_key === 'REIT' && d.type === 'BUY');
    expect(reitBuy).toBeDefined();
    expect(reitBuy!.description).toContain('acc-roth'); // ROTH preferred over DEFERRED for REIT
});
```

> Adapt the setup to match the existing test file's pattern for seeding accounts, holdings, and allocation nodes. The key assertion is that the description contains `acc-roth`, not `acc-deferred`.

 - [x] **Step 6: Run existing rebalancer tests**

```bash
npx vitest run src/lib/logic/__tests__/rebalancer.test.ts
```
Expected: all PASS

 - [x] **Step 7: Run full suite**

```bash
npx vitest run
```
Expected: all PASS

 - [x] **Step 8: Commit**

```bash
git add src/lib/logic/rebalancer.ts src/lib/logic/__tests__/rebalancer.test.ts
git commit -m "feat: rebalancer uses taxPlacement rules for BUY venue selection instead of string-match heuristics"
```

---

## Chunk 3: Fix Efficiency Module Asset Classification

### Task 3: Replace hardcoded ticker list with asset_registry classification

**Files:**
- Modify: `src/lib/logic/efficiency.ts`

**Context:** The current efficiency module identifies bond/REIT holdings by checking against a hardcoded ticker list:
```typescript
const isBondOrReit = ['BND', 'VNQ', 'FXNAX', 'AGG', 'VBTLX', 'TLT', 'IEF', 'SHY', 'TIP'].includes(h.ticker);
```
This breaks silently when users hold bonds or REITs not on this list. Fix: use `asset_registry.weights` to determine if a holding maps primarily to `'US Aggregate Bond'` or `'REIT'` labels — the same join key used throughout the system.

 - [x] **Step 1: Update the holdings query to include asset_registry weights**

Find (line ~12):
```typescript
    const holdings = db.prepare(`
        SELECT h.ticker, h.quantity, h.market_value, a.tax_character, ar.custom_er
        FROM holdings h
        JOIN accounts a ON h.account_id = a.id
        LEFT JOIN asset_registry ar ON h.ticker = ar.ticker
    `).all() as { ticker: string; quantity: number; market_value: number | null; tax_character: string; custom_er: number | null }[];
```

Replace with:
```typescript
    const holdings = db.prepare(`
        SELECT h.ticker, h.quantity, h.market_value, a.tax_character, ar.custom_er, ar.weights
        FROM holdings h
        JOIN accounts a ON h.account_id = a.id
        LEFT JOIN asset_registry ar ON h.ticker = ar.ticker
    `).all() as {
        ticker: string;
        quantity: number;
        market_value: number | null;
        tax_character: string;
        custom_er: number | null;
        weights: string | null;  // JSON string: Record<string, number>
    }[];
```

 - [x] **Step 2: Replace hardcoded ticker check with weights-based check**

Find (line ~35):
```typescript
        if (h.tax_character === 'TAXABLE' && meta?.yield != null) {
            const isBondOrReit = ['BND', 'VNQ', 'FXNAX', 'AGG', 'VBTLX', 'TLT', 'IEF', 'SHY', 'TIP'].includes(h.ticker);
            const taxRate = isBondOrReit ? ORDINARY_TAX_RATE : DIVIDEND_TAX_RATE;
            totalLocationLeakage += value * meta.yield * taxRate;
        }
```

Replace with:
```typescript
        if (h.tax_character === 'TAXABLE' && meta?.yield != null) {
            // Determine if this holding is primarily bonds or REIT
            // by checking its allocation weights from asset_registry.
            // These are the labels used across the whole system.
            let isTaxInefficient = false;
            if (h.weights) {
                try {
                    const w = JSON.parse(h.weights) as Record<string, number>;
                    const bondWeight = (w['US Aggregate Bond'] ?? 0);
                    const reitWeight = (w['REIT'] ?? 0);
                    isTaxInefficient = bondWeight + reitWeight > 0.5;
                } catch {
                    // malformed weights — default to efficient
                }
            }
            const taxRate = isTaxInefficient ? ORDINARY_TAX_RATE : DIVIDEND_TAX_RATE;
            totalLocationLeakage += value * meta.yield * taxRate;
        }
```

 - [x] **Step 3: Fix the first efficiency test to seed asset_registry**

The existing first test in `src/lib/logic/__tests__/efficiency.test.ts` inserts VNQ into holdings but **not** into `asset_registry`. After the fix, `h.weights` will be `null` for VNQ, causing the REIT/bond classification to silently fall through to the `DIVIDEND_TAX_RATE` path — wrong behavior, but the test may still pass by coincidence.

Find the first test block and add an `asset_registry` insert for VNQ:
```typescript
// Before the test's existing holding inserts, add:
db.prepare(`
    INSERT INTO asset_registry (ticker, canonical, weights, is_core, asset_type)
    VALUES ('VNQ', 'Vanguard Real Estate ETF', '{"REIT":1.0}', 0, 'ETF')
`).run();
```

This ensures the `weights`-based path (`bondWeight + reitWeight > 0.5`) is actually exercised and the test validates correct behavior.

 - [x] **Step 4: Add comment for the 0.5 threshold**

In `src/lib/logic/efficiency.ts`, add a comment explaining the threshold:
```typescript
// Majority-rule: classify as tax-inefficient if >50% of the holding
// maps to bond or REIT labels (ordinary income rate applies to that portion).
const isTaxInefficient = bondWeight + reitWeight > 0.5;
```

 - [x] **Step 5: Run existing tests**

```bash
npx vitest run
```
Expected: all PASS

 - [x] **Step 6: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

 - [x] **Step 7: Commit**

```bash
git add src/lib/logic/efficiency.ts src/lib/logic/__tests__/efficiency.test.ts
git commit -m "fix: efficiency module classifies bond/REIT holdings via asset_registry.weights, not hardcoded ticker list"
```
