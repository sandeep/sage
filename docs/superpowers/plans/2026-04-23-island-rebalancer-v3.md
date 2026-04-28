# Island Rebalancer (v3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragmented greedy solver with an atomic, tax-aware "Island Engine" that solves global allocation gaps using internal account liquidity only.

**Architecture:** 
1. **Island Isolation:** Every account is treated as a closed system for rebalancing.
2. **Atomic Swaps:** Directives are generated as linked pairs (Sell X to fund Y).
3. **Tax Guard:** Sale of positions with >$500 unrealized gain is blocked in taxable accounts.

**Tech Stack:** TypeScript, SQLite, Vitest, Tailwind.

---

### Task 1: Deprecate Legacy Rebalancer Logic

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`
- Delete: `src/lib/logic/rebalance/idealMap.ts`
- Delete: `src/lib/logic/rebalance/frictionBridge.ts`

- [ ] **Step 1: Purge Legacy Files**
Physically delete the outdated greedy solver files.

- [ ] **Step 2: Clean Engine Imports**
Update `rebalancer.ts` to remove references to the deleted modules.

---

### Task 2: Implement Island Strategy Mapper

**Files:**
- Create: `src/lib/logic/rebalance/islandEngine.ts`

- [ ] **Step 1: Define Island Interfaces**
```typescript
interface IslandCapacity {
    accountId: string;
    taxCharacter: 'TAXABLE' | 'ROTH' | 'DEFERRED';
    excess: Array<{ ticker: string; amount: number }>;
    shortfall: Array<{ assetClass: string; amount: number }>;
}
```

- [ ] **Step 2: Implement Gap-to-Island Distributor**
Create a function that takes the Global Gaps (from X-Ray) and identifies which "Islands" have the capability to solve them based on their internal overweight positions.

---

### Task 3: Implement Atomic Swap Solver

**Files:**
- Modify: `src/lib/logic/rebalance/islandEngine.ts`

- [ ] **Step 1: Implement Intra-Island Swap Loop**
For each account, iterate through its `excess` list and physically fund its `shortfall` list. 

- [ ] **Step 2: Implement Tax Liability Guard**
Add a check: `if (taxCharacter === 'TAXABLE' && (value - costBasis) > 500) skip;`.

- [ ] **Step 3: Generate "Move to Cash" Directives**
If excess exists but no shortfall remains (or vice versa), explicitly label as `(Move to Cash)`.

---

### Task 4: TaskBlotter UI Transformation

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

- [ ] **Step 1: Update Transaction Labels**
Render the new atomic swap format: **"Swap $Xk [Ticker] → [Target] in [Account]"**.

- [ ] **Step 2: High-Contrast "Targeted Liquidation" Badge**
Add a specific visual state for moves to Cash.

---

### Task 5: Final Validation (TDD)

- [ ] **Step 1: Verify Island Constraints**
1. Run rebalancer for 100% Stock portfolio with Bonds in a Roth IRA.
2. **Success Criteria:** Rebalancer ONLY suggests swaps inside the Roth IRA. ✅
3. **Success Criteria:** ZERO transfers between Roth and Taxable. ✅
