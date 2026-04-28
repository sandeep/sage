# Specification: Performance Evolution & Milestone Ledger

## 1. Executive Summary
This document defines the architecture for tracking the historical convergence of two independent timelines: **Strategic Targets** and **Actual Portfolio Milestones**. The goal is to visually and mathematically prove that both the strategy and the execution are moving toward the Efficiency Frontier over time.

## 2. Strategic Objectives
- **Independent Tracking:** Decouple strategy updates (rare) from portfolio snapshots (frequent).
- **Visual Convergence:** Plot both paths on the Efficiency Frontier with time-based saturation.
- **Data Integrity:** Implement a "Validation Gate" for snapshot dates and historical asset mapping.
- **Performance:** Cache 50-year risk/reward coordinates per milestone.

## 3. Data Architecture

### 3.1. Target Timeline (Existing)
Uses the `allocation_versions` table. Each record represents a strategic dot on the frontier.
- `id`, `label`, `snapshot` (weights), `start_date`, `end_date`, `nominal_return`, `sharpe_ratio`.

### 3.2. Portfolio Milestone Ledger (New)
A new table `portfolio_history` stores historical "Actuals".
- `id`: Primary Key.
- `snapshot_date`: User-verified date of the record.
- `source`: (e.g., 'FIDELITY_360', 'MANUAL_TABLE').
- `holdings_json`: Raw ticker/value map.
- `return_50y`: Cached 50Y historical return.
- `vol_50y`: Cached 50Y historical volatility.

## 4. Ingestion Pipeline: The "Validation Gate"

### 4.1. Fidelity 360 Importer
- Reuse existing parser but target the `portfolio_history` table.
- **Gate:** Prompt user to verify the `snapshot_date` before commit.

### 4.2. Manual Table Importer
- "Paste & Map" interface for historical percentage/value data.
- **Verification:** UI flags unmapped tickers and requires Simba proxy selection (e.g., "Old Fund X" -> "US Large Cap").

## 5. UI & Visualization

### 5.1. Convergence Frontier
The `PerformanceFrontier` chart is upgraded to plot two series:
1. **Target Path (Indigo):**
   - Older targets: Lower opacity/saturation.
   - Current target: High contrast Indigo.
2. **Execution Path (Rose to Emerald):**
   - Older portfolios: De-saturated Rose.
   - Recent/Rebalanced portfolios: High saturation Emerald.

### 5.2. Evolution Narrative
A textual summary derived from the ledger:
- "Regime 3 (Current) is 15% closer to the Frontier than Regime 1."
- "Rebalance on 2025-12-15 captured +0.8% in expected efficiency."

## 6. Performance & Constraints
- **Simulation Caching:** Risk/Reward is calculated ONCE at import time and stored in the ledger.
- **File Lengths:** New logic modules must stay under 250 lines.
