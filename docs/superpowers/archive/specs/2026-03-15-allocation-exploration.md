# Specification: Allocation Exploration Engine

**Goal:** Create a real-time, interactive environment to simulate changes to the target portfolio allocation and observe the immediate impact on performance (Expected CAGR), risk (Beta/Volatility), and efficiency (Tax/Expense Drag).

## 1. Core Objectives
- **Interactive Simulation:** Use sliders to adjust the `target_allocation.json` weights in memory.
- **Three-State Analysis:**
    1.  **Current:** The portfolio as it exists now (holdings + existing targets).
    2.  **Existing Target:** The static plan currently in the system.
    3.  **Future Exploration:** The proposed allocation change being modeled with sliders.
- **Efficiency Feedback Loop:** Show how moving from US Stocks to Emerging Markets (for example) increases expected return but also increases tax drag.

## 2. Technical Design

### A. The "Exploration" Mode
- Store a transient `target_allocation` state in React.
- Top-level weights (Stock, Bond, Cash) must always sum to 100%. If one slider moves, others should ideally move inversely (or show a validation error).
- Sub-category weights must sum to their parent category weight.

### B. Live Metric Engine
- Decouple `calculateHierarchicalMetrics` and `calculatePortfolioEfficiency` from the global `target_allocation.json` file.
- Allow passing a `target_map` (the slider state) to these functions.
- Every slider movement triggers a re-run of:
    - `calculatePortfolioExpectedCagr`
    - `calculatePortfolioEfficiency` (re-calc target drag)

### C. Comparison Dashboard
- **The "Before/After" Card:**
    - Metric: Expected CAGR | Before: 8.5% | After: 9.2% | Delta: +0.7%
    - Metric: Tax Drag | Before: 42 BPS | After: 56 BPS | Delta: +14 BPS
    - Metric: Net Alpha | Before: 8.08% | After: 8.64% | Delta: +0.56%

### D. Historical Tracking
- If a user "Accepts" a new allocation, store the previous `target_allocation.json` in a `target_history` table (SQLite) with a timestamp.
- Plot "Target Efficiency Over Time" to see if the user's strategic choices are improving the portfolio's theoretical ceiling.

## 3. UI/UX Requirements
- **Slider Component:** Custom minimalist sliders (Emerald/Zinc) with numeric inputs.
- **Toggle Sync:** Optionally sync the "Target" state with "Future Exploration" as a starting point.
- **Persistent Storage:** Allow saving "Draft Allocations" without overwriting the live `target_allocation.json`.

## 4. Migration Requirements
- Create `target_history` table in `schema.sql`.
- Add `migrate.ts` logic to handle the new table.
