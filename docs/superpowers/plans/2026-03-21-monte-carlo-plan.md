# Implementation Plan: Monte Carlo Strategic Audit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Implement a probabilistic Monte Carlo engine to simulate 10,000 possible futures based on historical asset class behaviors.

**Architecture:** Use a **Historical Bootstrap** approach. Instead of assuming a normal distribution, we reshuffle actual Simba annual returns (preserving correlations) to create synthetic 30-year paths.

**Tech Stack:** TypeScript, Math.js (optional), Recharts.

---

### Task 1: Monte Carlo Engine

**Files:**
- Create: `src/lib/logic/monteCarloEngine.ts`
- Test: `src/lib/logic/__tests__/monteCarlo.test.ts`

 - [x] **Step 1: Implement the Bootstrap Sampler.**
Build a function that randomly selects years from the Simba dataset (preserving asset correlations for each selected year).
 - [x] **Step 2: Implement Path Simulation.**
Simulate 10,000 paths of length `N` (e.g., 30 years).
 - [x] **Step 3: Derive Probabilistic Metrics.**
Calculate:
  - **Success Probability:** % of paths that stay above $X.
  - **Median Return:** 50th percentile.
  - **Tail Risk (VaR):** 5th and 1st percentile (The "Black Swan" scenarios).
 - [x] **Step 4: Commit engine.**

### Task 2: Monte Carlo UI (The Funnel Chart)

**Files:**
- Create: `src/app/components/MonteCarloFunnel.tsx`
- Modify: `src/app/audit/page.tsx`

 - [x] **Step 1: Build the Funnel Visual.**
Use Recharts `AreaChart` to show the range of outcomes (5th to 95th percentile) over time.
 - [x] **Step 2: Add Probability Headline.**
Display the "Strategy Success Score" based on your specific goal.
 - [x] **Step 3: Side-by-Side (Actual vs Target).**
Visually compare the "outcome funnels" of your drifted portfolio vs your strategy.
 - [x] **Step 4: Commit UI.**

### Task 3: Integration & Performance
 - [x] **Step 1: Cache MC results.**
Integrate with the `simulation_cache` from the previous plan (MC is expensive).
 - [x] **Step 2: Final audit pass.**
Ensure typography and privacy standards are maintained.
