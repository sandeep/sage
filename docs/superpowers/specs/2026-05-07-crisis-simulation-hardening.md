# Design Spec: Crisis Simulation Logic Hardening

## Overview
This spec documents the restoration of the "Crisis Simulation" table. It ensures that historical crash data is mathematically accurate, diversified, and reflects the user's specific asset mix rather than falling back to VTI.

## 1. Unified Asset Mapping
The system must use a consistent resolver to translate user labels (from `allocation_nodes`) into Simba asset class keys.

| User Label | Simba Key | Shock Class |
| :--- | :--- | :--- |
| Total Stock Market | TSM | Market (VTI) |
| US Large Cap/SP500/DJIX | LCB | Market (VTI) |
| Small Cap Value | SCV | SCV |
| REIT | REIT | REIT |
| Developed Market | INTL | Intl |
| Emerging Market | EM | Intl |
| US Aggregate Bond | ITT | Bond |

## 2. Weighted Intra-Year Shocks (1987, 2020)
For single-year "Flash Crashes," the engine must calculate a weighted average of specific asset class shocks.
- **Formula:** `Σ (Weight_i * Shock_i)`
- **Data Source:** `YEARLY_SHOCKS` constant in `comparisonEngine.ts`.

## 3. Multi-Year Sequence Simulation
For events like "Stagflation" (1973-1974) and "Dot-com" (2000-2002), the engine must use the annual return maps from the `AuditReport`.
- **Constraint:** If data for a specific year is missing from the Simba dataset (pre-1970 for some classes), it must use the designated Equity (TSM) or Bond (ITT) fallback.

## 4. UI Resilience Calculation
The "Addl. Capital at Risk" column must correctly identify underperformance.
- **Resilience Delta:** `Target_DD - Actual_DD`.
- **Logic:** If the Strategy lost 30% and the Actual Portfolio lost 40%, the delta is `(-0.30) - (-0.40) = +0.10`. This positive delta represents $10,000 of "Additional Risk" per $100k of capital.

# Implementation Plan

### Task 1: Engine Hardening (`comparisonEngine.ts`)
- [ ] Add `COVID-19` (2020) to `CRISIS_PERIODS`.
- [ ] Update `computeCrisisDrawdown` to use a global `SIMBA_MAP` resolver.
- [ ] Ensure `getComparisonData` passes the full `annualReturns` maps from the Audit Report to the drawdown calculator.

### Task 2: Data Linkage (`auditEngine.ts`)
- [ ] Export `actual` and `target` annual return maps in the `AuditReport` object.
- [ ] Ensure `currentWeights` accurately captures all level-2 leaf categories.

### Task 3: UI Restoration (`CrisisStressTableV2.tsx`)
- [ ] Fix the `resilienceDelta` sign-flip.
- [ ] Update the `isAtRisk` threshold to `0.001` (10bps) to avoid floating point noise.
- [ ] Ensure dollar formatting handles large amounts using standard 'k' notation.
