# Forensic Methodology

This document outlines the mathematical models and data engines used to generate the Performance Audit and Resilience metrics.

## Bootstrap Monte Carlo (Success Probability)
- **Sample Size:** 5,000 unique retirement paths.
- **Sampling Method:** Monthly sampling with replacement from the 1970-2024 historical dataset.
- **Inflation Adjustment:** All paths are inflation-adjusted using actual historical CPI-U data corresponding to the sampled months.
- **Logic:** Each path simulates a 30-year duration to determine the probability of portfolio survival (remaining above $0).

## Efficient Frontier (Efficiency Map)
- **Permutations:** 1,000 randomized weight permutations of the actual user asset pillars.
- **Data Source:** 50-year Simba historical returns and volatilities.
- **Goal:** To map the theoretical "Optimal" boundary (the Frontier) against the "Actual" portfolio to identify efficiency gaps.
- **Method:** Uses Mean-Variance Optimization (MVO) proxies to calculate expected return and volatility for each permutation.

## Crisis Reconstruction
- **Mapping:** Peak-to-trough Simba data mapping for specific historical "Black Swan" events.
- **Events Covered:**
    - 1973 Oil Crisis
    - 1987 Black Monday
    - 2000 Dot-com Bubble
    - 2008 Global Financial Crisis
- **Logic:** Reconstructs the current portfolio weights against historical returns during these exact periods to calculate "Additional Capital at Risk" compared to the Target Strategy.
