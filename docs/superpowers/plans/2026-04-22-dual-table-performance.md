# Dual-Table Forensic Implementation Plan (Refined)

**Goal:** Physically separate Absolute Returns from Risk-Adjusted Metrics across all horizons (1Y, 3Y, 50Y) to provide a high-signal "Wealth vs. Process" audit.

---

## 1. Final Physical Architecture

### Table 1: Physical P&L (Wealth Tracking)
*   **Columns:** 
    1. Period Detail
    2. Market Standard (VTI)
    3. Strategy Potential (% and $)
    4. Portfolio Realization (% and $)
    5. Execution Gap (% and $)

### Table 2: Risk-Adjusted Audit (Process Quality)
*   **Columns:**
    1. Period Detail
    2. Strategy Sharpe
    3. Portfolio Sharpe
    4. **Strategy Premium** (Strategy M2 vs Market)
    5. **Portfolio M2** (Actual Risk-Adjusted Return)
    6. **Execution Alpha** (Portfolio M2 - Strategy M2)
    7. Capture (U/D)

---

## 2. Implementation Tasks

### Task 1: Refactor PerformanceGridClientV2
**Files:** `src/app/performance/PerformanceGridClientV2.tsx`
*   Replace single table with two distinct `<table>` elements.
*   Ensure all 3 horizons (1Y Actual, 3Y Sim, 50Y Sim) are rendered in both.
*   Update headers to use "Strategy Premium" and "Portfolio M2".

### Task 2: Mathematical Synchronization
*   Calculate `Portfolio M2` as `row.portfolioM2VsVti + row.marketReturn`.
*   Calculate `Execution Alpha` as `row.m2DeltaVsTarget`.
*   Maintain the **1-decimal place** precision standard.

---

**Shall I proceed with this final dual-table implementation?** I will wait for your confirmation to execute.
