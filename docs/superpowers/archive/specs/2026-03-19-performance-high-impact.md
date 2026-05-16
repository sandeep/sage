# Spec: Performance High-Impact Dashboard & Multi-Horizon Risk

**Status:** Draft
**Owner:** Senior UX Designer / Senior Financial Analyst
**Date:** 2026-03-19

## 1. Executive Summary
The current Audit page presents data as a "technical report" which obscures the financial impact of suboptimal allocation. We will pivot to a "Cost of Inaction" narrative that emphasizes dollar-denominated losses and provides institutional-grade risk analysis across multiple time horizons (1Y, 3Y, 5Y).

## 2. Visual Identity & UX (The "Truth" Hero)

### 2.1 The Redacted Header
*   **Primary Metric:** Change "Estimated Annual Drag" to "TOTAL ANNUAL LOSS".
*   **Privacy Mode:** Replace `•••` with a stylized redacted value `$ ••,•••`. 
*   **Context Line:** "Based on $1.86M across 13 accounts. Prices as of 2026-03-19."

### 2.2 The Driver Cards (Logic States)
*   **[OPTIMIZED] State:** Minimalist ghost-card (emerald border). Text: "Tax Placement: Optimized. No leakage detected."
*   **[ACTION REQUIRED] State:** High-contrast card (rose/amber). Lead with the dollar amount: "-$59,675 / yr". Subtext: "Allocation Gap: Your mix expects 6.7% vs 9.9% target."
*   **Tooltips:** Technical definitions (e.g., "Estimated by multiplying basis points...") move to an info-icon tooltip.

## 3. Financial Analysis (Multi-Horizon Risk)

### 3.1 Time Horizons
*   Implement a horizon switcher: **1Y (Recent ETF) | 3Y (Historical) | 5Y (Cycle) | 10Y (Long-Run)**.
*   **1Y:** Uses Yahoo Finance `price_history`.
*   **3Y+:** Uses `simba_returns.json` asset class proxies to simulate the current allocation's behavior over historical cycles.

### 3.2 Key Analyst Metrics
*   **Risk Characterization:** 
    *   **Risk Forward:** Beta > 1.05. Taking more market risk for premium.
    *   **Risk Backward:** Beta < 0.95. Defensive posture, preserving capital.
*   **Alpha:** Total Return minus Beta-Adjusted Benchmark Return.
*   **Capture Ratios:**
    *   **Upside Capture:** % of benchmark gains captured during up months.
    *   **Downside Capture:** % of benchmark losses sustained during down months.

## 4. Implementation Plan

### Phase 1: High-Impact UI Overhaul
- [ ] **Task 1:** Update `CostOfInactionHero.tsx` with the new hierarchy and redacted styling.
- [ ] **Task 2:** Move card explanations into tooltips.
- [ ] **Task 3:** Create "Optimized" vs "Action" visual states for tiles.

### Phase 2: Multi-Horizon Analytics
- [ ] **Task 4:** Expand `portfolioEngine.ts` to calculate 3Y and 5Y returns using Simba data.
- [ ] **Task 5:** Implement Capture Ratio logic.
- [ ] **Task 6:** Add "Risk Posture" labels (Risk Forward/Backward) to the `RiskAdjustedPanel`.
