# Performance Audit: Forensic Status & Readiness Report

> **Date:** 2026-04-02
> **Subject:** Integrity Audit of Performance Math, Simulations, and UI Components.

## Executive Summary
The current Performance section has high **technical debt** in the mathematical models. While the UI looks professional, several core engines are using placeholders (randomized data) or are failing to pull data due to mapping gaps. This report identifies the root causes and defines the path to 100% mathematical integrity.

---

## 1. Markowitz Efficiency Map (The "Cloud")
### Status: Placeholder Math
*   **What it represents:** The "Universe of Possibility." It shows the range of risk/reward profiles you could achieve by varying the weights of your current assets.
*   **Current Logic:** It uses 5 hardcoded asset proxies with fixed returns/vols. It generates random points and applies a "magic number" (0.85) to fake the diversification benefit.
*   **Integrity Gap:** It does not reflect **your** specific assets or their **real historical correlations**.
*   **The Fix:** Implement a real **Covariance Matrix** calculation using 50 years of Simba data for the specific assets found in your portfolio.

## 2. Crisis Simulation & Long-Run Metrics
### Status: Data Mapping Failure
*   **Symptoms:** Actual and Strategy columns show "—" (null) for 1973, 2000, and 2008. Long-run metrics show 0.
*   **Root Cause 1 (Mapping):** The `simbaEngine` fails to map your high-fidelity database labels (e.g., `US Large Cap/SP500/DJIX`) to Simba keys (e.g., `LCB`).
*   **Root Cause 2 (Window):** The 50-year trailing window used in the simulation currently starts in **1976**, which physically excludes the 1973 Stagflation crisis.
*   **The Fix:** Harden the `LABEL_TO_SIMBA` map and expand the simulation window to **60 years** (1966–2026).

## 3. Success Probability (Monte Carlo)
### Status: High-Integrity / Low-Clarity
*   **What it represents:** Retirement survival probability. "In what % of historical market regimes would my money last 30 years?"
*   **Methodology:**
    1.  **Bootstrap Sampling:** Creates 10,000 synthetic futures by randomly shuffling monthly return blocks from 1970–2024.
    2.  **Inflation Adjustment:** Adjusts every sampled return for real-world inflation (CPI-U) from those specific months.
    3.  **Survival Logic:** Calculates the % of paths where the balance never hit $0.
*   **The Fix:** No math fix needed. The UI needs better labeling and tooltips to explain the "Reliability Score."

---

## 🛠 Required Hardening Plan

### Phase 1: Data Integrity (P0)
- [ ] Harden `LABEL_TO_SIMBA` mapping in `simbaEngine.ts` for 100% coverage.
- [ ] Expand simulation window to 60 years in `comparisonEngine.ts`.
- [ ] Implement `getHistoricalReturn` fallbacks to ensure no "blank" years in crisis simulations.

### Phase 2: Mathematical Correctness (P0)
- [ ] Replace hardcoded Efficient Frontier math with a real **Markowitz Optimization** proxy using the historical Correlation Matrix of the user's actual constituents.
- [ ] Stabilize the frontier cloud by moving simulation to the server and using a deterministic seed.

### Phase 3: UX Clarity (P1)
- [ ] Add "Institutional Methodology" tooltips to every header.
- [ ] Standardize typography and padding across all 6 performance tables.

---
**Verdict:** The system is **Technically Operational** but **Analytically Unreliable** until Phase 1 & 2 are completed.
