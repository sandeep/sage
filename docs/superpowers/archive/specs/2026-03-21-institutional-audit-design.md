# Specification: Institutional Alpha Leakage Audit

## 1. Executive Summary
The Audit page will be refactored into a high-density, institutional-grade performance dashboard. It replaces generic "backtesting" with a **Strategic Verdict** that surfaces uncompensated risk and structural inefficiencies.

The core narrative follows three stages:
1. **The Why (Efficiency):** Visual proof that the current portfolio is mathematically suboptimal (Frontier).
2. **The Where (Erosion):** Visual bridge from Strategy Potential to Realized Return (Waterfall).
3. **The Proof (Ledger):** Categorical "Invoice" of return leakage (Drift Ledger).

## 2. Strategic Objectives
- **Unify Truth:** Eliminate conflicting numbers by anchoring the entire page to a single math service (`auditEngine.ts`).
- **Surface Risk:** Prove that recent "outperformance" is a high-volatility mirage that fails historical stress tests.
- **Actionable Precision:** Quantify exactly how much money is "leaking" due to Cash, Underweights, and Fees.

## 3. Component Architecture

### A. PerformanceFrontier (NEW)
- **Type:** Scatter Plot (Recharts).
- **X-Axis:** Annualized Volatility (Risk).
- **Y-Axis:** Annualized Return (Reward).
- **Nodes:**
    - **VTI:** Market Benchmark (White).
    - **Target:** The "Efficient" point on the curve (Emerald).
    - **Actual:** The current portfolio (Rose).
- **Insight:** Visually shames the "Actual" dot for being below the "Target" curve.

### B. PerformanceWaterfall (NEW)
- **Type:** Bridge/Sankey-lite visual.
- **Logic:** Starts at **Target Strategy Return (18.0%)** and subtracts:
    - **Fee/Tax Erosion** (-0.2%)
    - **Cash Drag** (-2.6%)
    - **Strategic Drift** (-1.9%)
- **Endpoint:** **Actual Realized Return (13.3%)**.

### C. StrategicVarianceLedger (REFACTOR)
- **Type:** Heavy Institutional Grid.
- **Columns:**
    - `Source of Leakage` (Label)
    - `Under/Over Target Δ` (The Weight variance)
    - `Market Return` (The 1Y return of that proxy)
    - `Dollar Impact` (The calculated hit to the $1.86M base)
- **Categories:** US Large Cap, International, SCV/REITs, The Cash Trap.

### D. CrashResilienceAudit (UPDATE)
- **Update:** Add a column for **Actual (Simulated)**. 
- **Logic:** Map current portfolio weights to Simba proxies to show how the *current* mix would have performed in 2008 and 2000.

## 4. Mathematical Standards
- **Date Anchor:** All 1Y Actual math is fixed to **March 20, 2026** (Today) vs **March 20, 2025** (Start).
- **Risk-Free Rate:** Standardized at **5.0%** for all Sharpe/M2 calculations.
- **Denominator:** Consistent **$1,862,348.87** portfolio base for all dollar-impact figures.
- **Weight Guardrail:** Refuse any strategy calculation that does not sum to **100.0%**.

## 5. Design & Interaction
- **Typography:** No font smaller than `text-xs` (12px). Headlines at `text-xl/2xl`.
- **Colors:** Emerald (`text-emerald-500`) for strategy wins; Rose (`text-rose-500`) for leakage/risk.
- **Privacy:** Asterisk-based redaction (`$ **,***`) preserved.

## 6. Implementation Plan
1. **Phase 1:** Update `auditEngine.ts` to support coordinates for Frontier and Crisis Returns for Actual.
2. **Phase 2:** Build and inject the `PerformanceFrontier` chart.
3. **Phase 3:** Implement the `PerformanceWaterfall` bridge.
4. **Phase 4:** Complete the `StrategicVarianceLedger` refactor.
5. **Phase 5:** Final UI cleanup and regression audit.
