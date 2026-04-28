# Design Spec: Institutional-Grade Performance Audit Grid

**Status:** Approved (Final v5 with Mathematical Audit)
**Owner:** Senior UX Designer / Senior Financial Analyst
**Date:** 2026-03-19

## 1. Executive Summary
The Audit page provides a high-density "Decision Engine" that proves the cost of inaction using institutional-grade risk/reward metrics. It evaluates the portfolio across three horizons (1Y, 3Y, 5Y) against two benchmarks: the Market (VTI) and the Strategy (Custom Blended Target).

## 2. Analytical Framework (The Math)

### 2.1 Efficiency Metrics
*   **Nominal Return:** The raw percentage gain for the period.
*   **Sharpe Ratio:** `(Portfolio Return - Risk-Free Rate) / σ_portfolio`.
*   **M2 (Modigliani-Modigliani):** `(Portfolio Sharpe Ratio * Benchmark Volatility) + Risk-Free Rate`.
*   **Volatility Ratio (Risk Ratio):** `σ_portfolio / σ_benchmark`. Measures "Market Heat."
*   **Alpha (α):** Risk-adjusted excess return using CAPM.
*   **Consistency Rule:** All horizons use a **5.0% annualized Risk-Free Rate** ($Rf_{annual} = 0.05$).

### 2.2 Mathematical Audit (1Y Live Data)
Verified against actual portfolio state ($1.86M value, 13 accounts):
*   **Portfolio:** 6.85% Nominal | 16.00% Vol | 0.1046 Sharpe.
*   **Benchmark (VTI):** 16.75% Nominal | 18.64% Vol.
*   **Relative:** 0.86x Vol Ratio (Defensive) | 6.95% M2 (Risk-Adjusted).
*   **Execution Gap:** -9.80% M2 Delta vs VTI.

## 3. Visual Identity (The Truth Grid)

### 3.1 The Grid Layout
A high-density table showing 1Y ACTUAL, 3Y HISTORICAL, and 5Y HISTORICAL.
*   **Your Portfolio:** Nominal Return | Sharpe Ratio.
*   **Vs. Market (VTI):** VTI Nominal | M2 Delta | Vol Ratio | Alpha | Capture (U/D).
*   **Vs. Strategy (Target):** Target Nominal | Target Sharpe | M2 Delta | Annual $ Loss.

## 4. Technical Implementation

### 4.1 Data Sourcing & Fallbacks
*   **1Y:** Daily resolution using `price_history`.
*   **3Y/5Y:** Annual resolution using `simba_returns.json` proxies.
*   **Cash Proxy:** Fixed 5.0% annual return, 0% volatility for Simba simulations.
*   **Unmapped Tickers:** Exclude from historical simulation; redistribute weight; surface coverage %.

### 4.2 Components
*   Update `src/app/audit/page.tsx` to pre-calculate all 18+ metrics.
*   Create `PerformanceGrid` component to render the table with on-hover tooltips for all professional math terms.

---
**Spec approved by User on 2026-03-19.**
