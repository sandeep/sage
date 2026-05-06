# Design Spec: Strategic Efficiency Diagnostic (Global vs. Local Frontier)

## Overview
The current Efficient Frontier visualization only accounts for the "Local Universe" (the specific tickers currently held or targeted by the user). This identifies **Execution Error** (bad weighting) but ignores **Selection Error** (bad asset universe). 

This diagnostic introduces a second, higher-order frontier—the **Global Strategic Frontier**—built from the entire broad-market Simba asset class library. This allows the user to see if their overall strategy is inherently capped by their choice of instruments.

## Theoretical Framework

1.  **Global Strategic Frontier (The Ceiling):** 
    *   **Universe:** Canonical broad-market asset classes (Total Stock Market, Intl Stock, Small Cap Value, Emerging Markets, REITs, Intermediate Treasuries).
    *   **Purpose:** Shows the maximum theoretical efficiency available to a retail/institutional investor using standard building blocks.
2.  **Local Frontier (The Sub-Set):**
    *   **Universe:** Only the specific tickers currently in the user's strategy.
    *   **Purpose:** Shows the maximum efficiency possible *given the user's current constraints*.
3.  **The Error Decomposition:**
    *   **Selection Error:** The vertical distance between the Global Frontier and the Local Frontier.
    *   **Execution Error:** The vertical distance between the user's Actual Portfolio and the Local Frontier.

## Technical Requirements

### 1. Data Layer (`auditEngine.ts`)
*   Define a `GLOBAL_STRATEGIC_UNIVERSE` constant: `['TSM', 'INTL', 'SCV', 'EM', 'REIT', 'ITT']`.
*   Call `solveEfficientFrontier` twice:
    *   **Call 1 (Local):** Existing logic (Current + Target assets).
    *   **Call 2 (Global):** Entire `GLOBAL_STRATEGIC_UNIVERSE`.
*   Update `AuditReport` interface to include `globalFrontierPoints`.

### 2. Logic Layer (`optimizer.py`)
*   No changes needed; the current robust solver can handle any ticker list passed to it.

### 3. UI Layer (`EfficiencyMapClientV2.tsx`)
*   **Two-Line Plot:**
    *   **Global Frontier:** Solid grey line (The "Market Potential").
    *   **Local Frontier:** Solid emerald line (The "Portfolio Potential").
*   **New Metrics Panel:**
    *   **Selection Gap:** Distance from Local to Global Frontier.
    *   **Execution Gap:** Distance from Actual to Local Frontier.
*   **Verdict Logic:** Update the verdict to distinguish between "You need better weights" vs "You need better assets."

## Success Criteria
*   The chart displays two distinct frontier curves.
*   The "Selection Error" is quantified in basis points.
*   The build remains stable and passing type checks.
