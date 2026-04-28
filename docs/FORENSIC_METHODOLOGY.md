# Sage v2.0 Forensic Methodology

This document outlines the mathematical models and data engines used to generate the Performance Audit and Resilience metrics.

## 1. Success Probability (Bootstrap Monte Carlo)
The Success Probability score is calculated using a **Bootstrap Monte Carlo** simulation.
- **Data Source:** Monthly historical returns for the major asset classes (TSM, INTL, ITT, SCV, REIT) from 1970 to 2024.
- **Method:**
    1. The engine maps your current portfolio weights to these historical proxies.
    2. It simulates **5,000 unique retirement paths**.
    3. Each path is 30 years long, created by randomly sampling 360 monthly return "blocks" from the historical dataset (with replacement).
    4. **Inflation:** Every path is inflation-adjusted using actual historical CPI-U data corresponding to the sampled months.
    5. **Survival:** A path is considered a "Success" if the portfolio balance remains above $0 for the entire 30-year duration.
- **Output:** The Reliability Score is the percentage of successful paths.

## 2. Efficiency Map (Markowitz Frontier)
The "Cloud" of green dots on the Efficiency Map is a **Mean-Variance Optimization (MVO)** proxy.
- **Method:**
    1. We define 5 core "Pillars of Growth" based on your asset mix (Total Stock, International, Small Cap Value, REITs, and Treasuries).
    2. We generate **1,000 randomized weight permutations** of these pillars.
    3. For each permutation, we calculate the expected return and volatility based on 50 years of Simba historical data.
    4. **Diversification Alpha:** We apply a conservative correlation-reduction factor (0.85) to account for the mathematical benefit of holding non-correlated assets.
- **Goal:** To show how your "Actual" portfolio compares to the theoretical "Optimal" boundary (the Frontier).

## 3. Resilience Audit (Crisis Reconstruction)
The Crisis Simulation shows how your portfolio would have behaved during historical market crashes.
- **Method:**
    1. We identify specific "Black Swan" periods (e.g., 1973 Oil Crisis, 1987 Black Monday, 2000 Tech Bubble, 2008 GFC).
    2. We use the **Peak-to-Trough** price data from the Simba dataset for each of your asset classes during those exact months.
    3. We reconstruct your *current* weights against those *historical* returns.
- **Output:** "Additional Capital at Risk" is the calculated dollar difference in drawdown between your **Target Strategy** and your **Actual (Drifted) Portfolio**.

## 4. Institutional Metrics
- **M2 (Modigliani-Modigliani):** Adjusts your portfolio return to match the risk level of the benchmark (VTI), allowing for a true "Apples-to-Apples" comparison of management skill.
- **Alpha:** The excess return generated over the risk-adjusted market expectation (CAPM-based).
- **Capture Ratios:** Calculated using daily 1Y data to show what % of market "Up days" and "Down days" your portfolio participated in.
