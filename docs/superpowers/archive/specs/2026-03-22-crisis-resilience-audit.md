# Specification: Institutional Crisis Resilience Audit (The Pain Audit)

## 1. Executive Summary
This document defines the technical requirements for an expanded historical stress-test framework. It replaces the current calendar-year crisis table with a Peak-to-Trough Maximum Drawdown analysis across five decades of market catastrophes, providing visual and mathematical proof of strategic resilience.

## 2. Strategic Objectives
- **Emotional Reality:** Shift from annual returns to Peak-to-Trough drawdowns to accurately represent historical "pain."
- **Expanded Coverage:** Include key macro regimes: 1970s Stagflation, 1987 Black Monday, 2000 Dot Com, 2008 GFC, and 2022 Inflation Surge.
- **Strategic Verdict:** Quantify the "Resilience Alpha"—the percentage of losses avoided by following the Strategy vs. the Actual Portfolio drift.

## 3. Data Dictionary: The Pain Windows

The following windows will be codified in `comparisonEngine.ts`:

| Event | Years | Macro Driver |
| :--- | :--- | :--- |
| **Stagflation** | 1973-1974 | High Inflation + High Rates |
| **Black Monday** | 1987 | Liquidity Shock |
| **Dot Com** | 2000-2002 | Tech Bubble Burst |
| **GFC** | 2008 | Systemic Financial Collapse |
| **Inflation Surge** | 2022 | Post-COVID Bond/Stock Correlation |

## 4. Technical Logic

### 4.1. Peak-to-Trough Math
For each window, the engine will:
1. Reconstruct the **Compounded NAV Series** for Market, Strategy, and Portfolio using Simba annual data.
2. Calculate the **Maximum Drawdown** within that specific sequence using `computeMaxDrawdown(nav)`.
3. Returns are expressed as negative percentages (e.g., -32.1%).

### 4.2. Resilience Alpha
A new metric calculated for the UI:
`Resilience Alpha = Strategy Drawdown - Portfolio Drawdown`
(Positive value indicates the Strategy protected more capital than the current drifted portfolio).

## 5. UI Architecture

### 5.1. Expanded Crisis Table
The `CrisisStressTable.tsx` will be upgraded to:
- Show the five canonical windows.
- Use **Rose/Emerald** indicators for individual row winners.
- Display the **Max Drawdown** rather than calendar return.

### 5.2. Narrative Logic
Generate a high-density insight:
- "Strategy v1 would have protected **+$45,200** more capital during the GFC than your current drift."

## 6. Constraints
- **Engine Consistency:** Must use the same `calculateHistoricalProxyReturns` logic as the Frontier and Grid.
- **File Limits:** Maintain modularity; logic must not exceed 250 lines in `comparisonEngine.ts`.
