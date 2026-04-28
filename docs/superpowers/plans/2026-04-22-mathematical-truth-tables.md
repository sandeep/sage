# Mathematical Truth Tables Plan

**Goal:** Physically separate Wealth (Absolute) from Process (Risk-Adjusted) using precise mathematical labels, all historical horizons, and instructional tooltips.

---

## 1. Final Physical Grid

### Table 1: Physical P&L
*   **Columns:** 
    1. Period Detail
    2. Market Standard (VTI)
    3. Strategy Potential (% and $)
    4. Portfolio Realization (% and $)
    5. Execution Gap (% and $)

### Table 2: Risk-Adjusted Audit
*   **Columns:**
    1. Period Detail
    2. Strategy Sharpe
    3. Portfolio Sharpe
    4. **Strategy M2** (Risk-Adjusted Mandate)
    5. **Portfolio M2** (Risk-Adjusted Reality)
    6. **Execution Alpha (M2 Δ)** (Mandate Gap)
    7. Capture (U/D)

---

## 2. Implementation Tasks

### Task 1: Refactor PerformanceGridClientV2
**Files:** `src/app/performance/PerformanceGridClientV2.tsx`
*   Replace single table with two distinct `<table>` elements.
*   Update headers to **Strategy M2**, **Portfolio M2**, and **Execution Alpha (M2 Δ)**.
*   Render all 3 horizons (1Y Actual, 3Y Sim, 50Y Sim) in both grids.

### Task 2: Mathematical Precision
*   Strategy M2 = `targetM2VsVti + marketReturn`
*   Portfolio M2 = `portfolioM2VsVti + marketReturn`
*   Execution Alpha (M2 Δ) = `Portfolio M2 - Strategy M2`
*   Lock all to **1 decimal place**.

### Task 3: Tooltip Enrichment
**Definitions:**
*   **M2 (Modigliani-Modigliani):** The return a portfolio would have achieved if it had the same volatility as the market (VTI).
*   **Strategy M2:** The risk-adjusted potential of your target strategy.
*   **Portfolio M2:** The risk-adjusted realization of your actual portfolio.
*   **Execution Alpha (M2 Δ):** The physical gap in risk-adjusted performance caused by drift and structural choices.

---

**Shall I execute this high-integrity plan?** I will wait for your confirmation.
