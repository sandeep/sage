# Unified Rebalance Directive Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Physically merge tax placement and fee optimization tasks into the main Rebalance Directives queue on the Overview page.

**Architecture:** 
1. **Engine Unification:** Refactor `rebalancer.ts` to include a "Structural Pass" that calls existing risk engines.
2. **Persistence:** Map ephemeral risks to the `directives` table using new `PLACEMENT` and `OPTIMIZATION` types.
3. **UI Badging:** Update `TaskBlotter` to render these types with high-contrast institutional styling.

**Tech Stack:** TypeScript, SQLite (Better-SQLite3), Vitest, Tailwind CSS.

---

### Task 1: Rebalancer TDD & Structural Pass

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`
- Create: `src/lib/logic/__tests__/structural_directives.test.ts`

- [ ] **Step 1: Write failing test for structural conversion**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { generateDirectives } from '../rebalancer';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';

describe('Structural Directive Integration', () => {
    beforeEach(() => { setupTestDb(); });

    it('should physically convert a Fee Risk into an OPTIMIZATION directive', async () => {
        // Setup a $50k position in expensive VTIVX (8 bps)
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-1', 'FIDELITY', 'TAXABLE')").run();
        db.prepare(`INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, market_value, asset_type) 
                   VALUES (date('now'), 'acc-1', 'VTIVX', 100, 50000, 'ETF')`).run();
        db.prepare("INSERT INTO ticker_meta (ticker, name, er) VALUES ('VTIVX', 'Expensive', 0.0008)").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) VALUES ('VTIVX', 'Target', '{\"TSM\":1}', 'ETF', 0)").run();

        await generateDirectives();
        const directives = db.prepare("SELECT * FROM directives WHERE type = 'OPTIMIZATION'").all();
        
        expect(directives.length).toBeGreaterThan(0);
        expect(directives[0].description).toContain('Swap VTIVX');
    });
});
```

- [ ] **Step 2: Implement Structural Pass in Engine**
Update `generateV2Directives` to append structural items.

```typescript
// Inside generateV2Directives
const feeRisks = getExpenseRisks();
feeRisks.forEach(risk => {
    directives.push({
        type: 'OPTIMIZATION' as any,
        description: `Swap ${risk.currentTicker} → ${risk.betterTicker}`,
        priority: 'MEDIUM',
        reasoning: `Eliminate ${risk.savingsBps.toFixed(1)} bps Excess Expense Ratio`,
        link_key: risk.currentTicker,
        amount: risk.potentialSavings
    });
});
```

- [ ] **Step 3: Run test and verify it passes**
Run: `npx vitest src/lib/logic/__tests__/structural_directives.test.ts`

---

### Task 2: TaskBlotter UI Alignment

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

- [ ] **Step 1: Update Badge Styling**
Add high-contrast mapping for the new types.

```typescript
const TYPE_COLORS: Record<string, string> = {
    BUY: 'text-emerald-500 bg-emerald-500/10',
    SELL: 'text-rose-500 bg-rose-500/10',
    OPTIMIZATION: 'text-amber-500 bg-amber-500/10',
    PLACEMENT: 'text-indigo-500 bg-indigo-500/10'
};
```

---

### Task 3: Final System Validation

- [ ] **Step 1: Physical Verification**
1. Run `generateDirectives()`.
2. Confirm the Overview page now shows both "Trim FZROX" AND "Swap VTIVX → FZROX" in the same list. ✅
3. Confirm "View Trade" links from Performance page correctly focus these items. ✅
