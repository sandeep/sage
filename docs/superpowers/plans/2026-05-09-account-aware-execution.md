# Account-Aware Execution Implementation Plan (Phase 3, P1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the rebalancer from a theoretical advisor into an account-aware execution engine by ensuring every trade instruction identifies the specific source account and ID.

**Architecture:** 
1.  Refactor `getExpenseRisks` to evaluate holdings at the individual position level (preserving account metadata) instead of aggregate ticker level.
2.  Upgrade the `directives` generation logic to populate `account_id` and specific account-centric descriptions.
3.  Enhance the UI to display the account context in the Fee Optimization tiles.

**Tech Stack:** TypeScript, Next.js, SQLite (better-sqlite3), Tailwind CSS.

---

### Task 1: Refactor Expense Risk Engine for Account Awareness

**Files:**
- Modify: `src/lib/logic/xray_risks.ts`

- [ ] **Step 1: Update the `ExpenseRisk` interface**
Add `accountId` and `accountName` to the interface.

```typescript
export interface ExpenseRisk {
    currentTicker: string;
    currentEr: number;
    betterTicker: string;
    betterEr: number;
    savingsBps: number;
    potentialSavings: number;
    // New Fields
    accountId: string;
    accountName: string;
}
```

- [ ] **Step 2: Remove ticker-aggregation in `getExpenseRisks()`**
Refactor the function to iterate over the raw holdings list provided by `getHoldings()`.

```typescript
export function getExpenseRisks(): ExpenseRisk[] {
    const holdings = getHoldings() as { 
        ticker: string; 
        quantity: number; 
        market_value: number | null;
        nickname: string;
        account_id: string;
    }[];
    // ...
}
```

- [ ] **Step 3: Evaluate each position individually**
Remove the `holdings.reduce` block that previously grouped by ticker. For each holding row, calculate the savings if a cheaper alternative exists.

```typescript
    holdings.forEach(h => {
        const val = resolveValue(h.ticker, h.quantity, h.market_value);
        if (!val || val < 1000) return; // Keep the $1k threshold

        // ... (find bestAlt logic remains same) ...

        if (bestAlt && (currentEr - bestAlt.er) > 0.0005) {
            risks.push({
                currentTicker: h.ticker,
                currentEr,
                betterTicker: bestAlt.ticker,
                betterEr: bestAlt.er,
                savingsBps: (currentEr - bestAlt.er) * 10000,
                potentialSavings: val * (currentEr - bestAlt.er),
                // Capture Metadata
                accountId: h.account_id,
                accountName: h.nickname
            });
        }
    });
```

- [ ] **Step 4: Verify with a logic test**
Run: `npm test src/lib/logic/__tests__/efficiency.test.ts`
Expected: Tests should pass, confirming no regressions in the base calculation.

---

### Task 2: Implement Execution-Ready Directives

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`

- [ ] **Step 1: Remove hardcoded "Fidelity Individual" placeholder**
Update `generateV2Directives` to use the `accountName` and `accountId` provided by the refactored `ExpenseRisk` objects.

```typescript
    const feeRisks = getExpenseRisks();
    feeRisks.forEach(risk => {
        directives.push({
            type: 'OPTIMIZATION',
            description: `Swap ${risk.currentTicker} → ${risk.betterTicker} in ${risk.accountName}`, 
            priority: 'MEDIUM',
            reasoning: `Eliminate ${risk.savingsBps.toFixed(1)} bps Excess Expense Ratio`,
            link_key: risk.currentTicker,
            amount: risk.potentialSavings,
            account_id: risk.accountId // Populate DB field correctly
        });
    });
```

- [ ] **Step 2: Verify database population**
Run a manual check or temporary script to ensure `account_id` is now stored in the `directives` table.

---

### Task 3: UX Integration - Actionable Account Labels

**Files:**
- Modify: `src/app/passive/StructuralCostCenter.tsx`

- [ ] **Step 1: Update the 'Fee Optimization' tile**
Ensure the UI renders the account name in the trade description. Since we renamed the fields in Task 1, update the map logic.

```tsx
<div className="text-ui-label font-black text-white uppercase tracking-tighter">
    Swap {risk.currentTicker} → {risk.betterTicker} in {risk.accountName}
</div>
```

- [ ] **Step 2: Add Account ID metadata to the 'View Trade' link (Pre-work for P2)**
Update the link or a data attribute to include the account ID for future forensic filtering.

---

### Task 4: Final Verification

- [ ] **Step 1: Build Check**
Run: `npm run build`
Expected: Success.

- [ ] **Step 2: Visual Audit**
Start dev server and verify that recommendations now look like: 
*"Swap VTIVX → FZROX in **Vanguard 401k**"* instead of a generic or hardcoded string.
