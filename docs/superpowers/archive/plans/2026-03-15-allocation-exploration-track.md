# Track: Allocation Exploration Engine

**Status:** Draft Specification Ready
**Objective:** Implement interactive target allocation simulation with sliders and real-time efficiency impact analysis.

## Roadmap

### Phase 1: Engine Decoupling
- [x] Refactor `calculateHierarchicalMetrics` to accept an optional `targetAllocation` override.
- [x] Refactor `calculatePortfolioEfficiency` to accept an optional `targetAllocation` override.
- [x] Create `target_history` table in SQLite for tracking strategic shifts.

### Phase 2: Simulation UI
- [x] Build `AllocationSlider` component with Emerald/Zinc aesthetic.
- [x] Implement `AllocationExplorer` container with three-state logic (Current, Target, Exploratory).
- [x] Display real-time Delta comparison (Before vs After) for Expected Return, Tax Drag, and Expense Drag.

### Phase 3: Historical Analysis
- [x] Implement "Accept New Allocation" workflow.
- [x] Build "Allocation Drift over Time" chart to visualize strategic consistency.

---
*Reference Specification:* `docs/superpowers/specs/2026-03-15-allocation-exploration.md`
