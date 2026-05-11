# Implementation Plan: Execution Desk (Phase 3 - Zero-Regex)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the rebalancer into a high-integrity, data-first execution engine by eliminating fragile string parsing (regex) and integrating advanced instrument resolution.

**Architecture:** 
1.  **Data-First Directives**: Add explicit fields (`source_ticker`, `target_ticker`, `amount`) to the directive engine.
2.  **Unified Pipeline**: Integrate `instrumentResolver` for broker-native funds and `frictionBridge` for automated tranches.
3.  **Refined Blotter**: A professional UI that groups by physical account and uses structured data for zero-ambiguity execution.

**Tech Stack:** TypeScript, Next.js, SQLite.

---

### Task 1: Structured Data Evolution (Zero-Regex Core)

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`
- Modify: `src/lib/logic/rebalance/islandEngine.ts`
- Modify: `src/lib/logic/rebalance/washSaleGuard.ts`

- [ ] **Step 1: Update `Directive` interface**
Add explicit fields to the interface in `rebalancer.ts` to move away from "Description-parsing".

```typescript
export interface Directive {
    // ... existing fields ...
    source_ticker?: string; // Ticker being sold/trimmed
    target_ticker?: string; // Ticker being bought/swapped into
    amount?: number;        // The raw dollar amount of the action
}
```

- [ ] **Step 2: Update `islandEngine.ts` to populate structured fields**
Ensure `solveIslands` sets the `source_ticker` and `target_ticker` correctly for every rebalance.

- [ ] **Step 3: Refactor `washSaleGuard.ts` (Eliminate Regex)**
Change the scrubbing logic to check `d.source_ticker` or `d.target_ticker` instead of searching inside the `description` string.

---

### Task 2: High-Integrity Logic Pipeline

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`
- Modify: `src/lib/logic/rebalance/frictionBridge.ts`

- [ ] **Step 1: Integrate `instrumentResolver`**
Replace `resolveTickerForCategory` with the tiered `resolveInstrument` function in the rebalance loop. This ensures we pick funds based on what the user already owns or what the broker provides for free.

- [ ] **Step 2: Refactor `frictionBridge.ts` (Eliminate Regex)**
Update `splitIntoTranches` to calculate the new amount using the `amount` field directly, and then regenerate the description from the data.

- [ ] **Step 3: Implement Fractional Delta logic in `mapIslands`**
Ensure multi-asset funds are correctly decomposed into their constituent categories during the island mapping phase.

---

### Task 3: The Execution Blotter UI (v2)

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

- [ ] **Step 1: Remove `parseAccount` regex**
Join the `directives` with the `accounts` table to get the physical `nickname` and `provider`. Use `directive.account_id` as the primary key.

- [ ] **Step 2: Actionable Trade Grouping**
Group trades by physical account. Add a "Copy to Broker" header for each group with the account number/name clearly visible.

---

### Task 4: Verification

- [ ] **Step 1: End-to-End Execution Test**
Write a test that seeds a complex multi-account state and verifies that:
1.  Trades are split into tranches if large.
2.  Tickers match the broker-native funds (FZROX for Fidelity, etc.).
3.  Directives contain structured `source_ticker` and `target_ticker` data.
