# Account-Aware Rebalancer v2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Transform the rebalancer from a heuristic "3-pass" model into a "Target-State" solver that defines the perfect account-level asset distribution and calculates the most tax-efficient bridge to get there.

**Architecture:** 
1. **Ideal Map (Blueprint):** Calculate exactly what every account should look like based on tax tiers.
2. **Friction Solver (The Bridge):** Identify gaps and generate account-aware trades.
3. **Wash Sale Guard:** Filter buys against a 30-day "Sold at Loss" log and divert to proxy twins.

**Tech Stack:** TypeScript, SQLite, better-sqlite3.

---

### Task 1: The Blueprint Engine (Ideal Map)

**Files:**
- Create: `src/lib/logic/rebalance/idealMap.ts`
- Test: `src/lib/logic/rebalance/__tests__/idealMap.test.ts`

 - [x] **Step 1: Write the failing test for Blueprint generation.**
Ensure it fills Roth with SCV and Deferred with REITs first.
 - [x] **Step 2: Implement the "Greedy" Placement Algorithm.**
Distribute target dollars across account types (Roth -> Deferred -> Taxable).
 - [x] **Step 3: Run tests and verify.**
 - [x] **Step 4: Commit.**
```bash
git commit -m "feat: implement idealMap generator for rebalancer v2"
```

### Task 2: The Friction Solver (Reconciliation Bridge)

**Files:**
- Create: `src/lib/logic/rebalance/frictionBridge.ts`
- Test: `src/lib/logic/rebalance/__tests__/frictionBridge.test.ts`

 - [x] **Step 1: Write the failing test for trade generation.**
Ensure it correctly pairs overweight/underweight within the same account.
 - [x] **Step 2: Implement the Reconciler.**
Generate minimal trade set to align Actual $\rightarrow$ Ideal.
 - [x] **Step 3: Implement Taxable Thresholds.**
Ignore taxable trims smaller than $1,000 to minimize tax friction.
 - [x] **Step 4: Run tests and verify.**
 - [x] **Step 5: Commit.**
```bash
git commit -m "feat: implement frictionBridge trade generator"
```

### Task 3: The Wash Sale Gate

**Files:**
- Create: `src/lib/logic/rebalance/washSaleGuard.ts`
- Modify: `src/lib/db/migrate.ts` (add `wash_sale_lockouts` table)

 - [x] **Step 1: Create the lockout table.**
```sql
CREATE TABLE IF NOT EXISTS wash_sale_lockouts (
    ticker TEXT PRIMARY KEY,
    locked_until DATETIME NOT NULL
);
```
 - [x] **Step 2: Implement the Guard logic.**
If a proposed BUY is for a locked ticker, swap it for the proxy defined in `asset_registry`.
 - [x] **Step 3: Commit.**
```bash
git commit -m "feat: implement wash sale guard and proxy diversion"
```

### Task 4: Versioned Orchestration

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`

 - [x] **Step 1: Implement the Version Toggle.**
Add `const ENGINE_VERSION = 'v2'`.
 - [x] **Step 2: Route generateDirectives.**
If `v2`, call the new `targetStateEngine`.
 - [x] **Step 3: Final verification.**
Verify that the UI displays the new account-level instructions correctly.
 - [x] **Step 4: Commit.**
```bash
git commit -m "feat: enable rebalancer v2 with versioned orchestration"
```
