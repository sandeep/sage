# Performance Engine & Audit Page Integrity Meta-Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Restore confidence in the performance metrics by fixing runtime crashes, auditing the underlying math, and adding transparency to the data pipeline.

**Architecture:** A three-phase approach: (1) Fix the crash, (2) Validate the logic with TDD, (3) Add "Show the Work" transparency to the UI.

**Tech Stack:** Next.js 15, TypeScript, better-sqlite3, Vitest, Tailwind CSS.

---

## Phase 1: The Runtime Fix (Systematic Debugging)

**Goal:** Get the `/audit` page to render without crashing, even if data is missing.

 - [x] **Task 1: Identify the crash.** 
    - Use `browser_eval` or server logs to find the exact line causing the crash in `src/app/audit/page.tsx`.
    - Likely culprits: `vtiRows[0].close` (index out of bounds) or `targetSim.nav[0]` (null access).

 - [x] **Task 2: Add Defensive Guards.**
    - Wrap DB results in empty-check guards.
    - Provide `null` fallbacks for all metrics.
    - Update components (`CostOfInactionHero`, `RiskAdjustedPanel`) to handle `null` props by rendering "—" or "Calculating..." instead of erroring.

---

## Phase 2: The Math Audit (TDD & Verification)

**Goal:** Prove the numbers are "real" by comparing them against manual calculations and benchmarks.

 - [x] **Task 3: Ground Truth Benchmark Test.**
    - Create `src/lib/logic/__tests__/performance_integrity.test.ts`.
    - Test Case: Seed a portfolio with 100 shares of VTI. 
    - Assert: `calculatePortfolioPerformance().return1y` matches the manually calculated return from the `price_history` table for VTI.

 - [x] **Task 4: Dollar-to-BPS Audit.**
    - Verify the conversion logic in `AuditPage`: `(dragBps / 10000) * portfolioValue`.
    - Ensure `portfolioValue` correctly includes Cash and Unpriced assets (Institutional Trust etc.) so the "denominator" is correct.

---

## Phase 3: Data Transparency (Show the Work)

**Goal:** Add UI elements that explain where the numbers come from.

 - [x] **Task 5: "As Of" and "Portfolio Value" labels.**
    - Add a sub-header to the Hero zone showing the total portfolio value and price staleness: "Analyzed $1,240,500 across 8 accounts. Prices as of 2026-03-18."

 - [x] **Task 6: Logic Tooltips.**
    - Add help icons to "Tax Leakage" and "Fee Drag" explaining: "Estimated by multiplying BPS drag by total account value."

---

## Phase 4: Final Verification

 - [x] **Task 7: Full Suite Pass.**
    - Run `npx vitest run`.
    - Run `npm run build`.
    - Perform a manual "Confidence Walk" through the page to ensure every number feels grounded.
