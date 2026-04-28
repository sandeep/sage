# Specification: Account-Aware Rebalancer v2.0 (Target-State)

## 1. Executive Summary
This document defines the architecture for a second-generation rebalancing engine. It shifts from a heuristic "3-pass" model to a "Target-State" model: defining the perfect distribution of assets across accounts first (The Blueprint), and then calculating the most tax-efficient trades to reach that state (The Bridge).

## 2. Strategic Objectives
- **Global Optimum:** Solve for the entire household at once, rather than account-by-account.
- **Tax-Type Prioritization:** Automatically place high-growth assets in Roth and high-yield/inefficient assets in Deferred.
- **Wash Sale Guard:** Prevent disallowed buys using a 30-day transaction lockout and proxy asset diversion.
- **Configurable Coexistence:** Allow switching between v1 (Heuristic) and v2 (Target-State) via a `REBALANCER_ENGINE_VERSION` flag.

## 3. Architecture & Componentization

The system is decomposed into four independent units:

### 3.1. Unit A: The Blueprint Engine (`idealMap.ts`)
- **Input:** Total Portfolio Value, Account Capacities (Roth/Deferred/Taxable), Target Strategy Weights.
- **Logic:** Distributes every target dollar into specific accounts based on **Tax Location Tiers**.
- **Output:** `IdealPortfolioMap` (Record of AccountID -> Record of Ticker -> TargetAmount).

### 3.2. Unit B: The Reconciliation Solver (`frictionBridge.ts`)
- **Input:** `IdealPortfolioMap`, `ActualHoldingsMap`.
- **Logic:** Identifies the "Gaps" per account. 
- **Iteration Strategy:**
  1. **Internal Swaps:** Pair overweight/underweight within the same account (Zero tax friction).
  2. **Cash Injections:** Use idle cash to buy underweight targets.
  3. **Cross-Account Trims:** Only sell in taxable if the gap exceeds a threshold (e.g., $1,000) or 5% drift.

### 3.3. Unit C: The Wash Sale Gate (`washSaleGuard.ts`)
- **Logic:** Checks proposed "BUY" trades against a 30-day "Sold at Loss" log.
- **Diversion:** If `VTI` is locked, suggest `ITOT` (Proxy) for 31 days.

### 3.4. Unit D: The Versioned Orchestrator (`rebalancer.ts` refactor)
- **Flag:** `const ENGINE_VERSION = 'v2';`
- **Logic:** Routes the `generateDirectives()` call to either the legacy `heuristicEngine` or the new `targetStateEngine`.

## 4. Technical Constraints
- **Module Independence:** No module should depend on the internal state of another. 
- **File Length:** Every new logic module must be **< 250 lines**.
- **Idempotency:** Running the rebalancer multiple times without executing trades must produce the same result.

## 5. Persistence
- Proposed directives are stored in the existing `directives` table.
- A new `wash_sale_lockouts` table will track the 31-day lockout periods.
