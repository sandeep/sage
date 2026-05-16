# Human Language IA Realignment Plan

**Goal:** Synchronize the Performance Suite with simple, direct language describing money lost to specific strategic and product errors.

---

## 1. Unified Vocabulary (The "Truth" Labels)

| Physical Fact | UI Label | Component |
| :--- | :--- | :--- |
| Strategy Opportunity | **Strategy Potential** | Performance Bridge |
| Asset Mix Error | **Lost: Wrong Asset Mix** | Performance Bridge |
| Fund Expenses | **Lost: Fund Fees** | Performance Bridge, Cost Audit |
| Tax Placement Error | **Lost: Wrong Tax Placement** | Performance Bridge, Cost Audit |
| Specific Optimization | **Excess Fee Opportunity** | Cost Audit (Drill-down) |
| Bottom Line | **Realized Return** | Performance Bridge |

---

## 2. Implementation Tasks

### Task 1: Performance Bridge "Humanizing"
**Files:** `src/app/performance/PerformanceWaterfallClientV2.tsx`
*   Replace "Fee Drag" with **"Lost: Fund Fees"**.
*   Replace "Tax Leakage" with **"Lost: Wrong Tax Placement"**.
*   Replace "Strategic Drift" with **"Lost: Wrong Asset Mix"**.
*   Ensure the "Realized Return" is the final, high-contrast result.

### Task 2: Cost Audit Component (Replacing Leakage/Drag Audit)
**Files:** `src/app/performance/CostAuditV2.tsx`
*   Header: **"Cost Audit"**. Subtitle: **"Portfolio fees and tax location errors"**.
*   Hero Boxes: **"Total Portfolio Erosion"**, **"Fund Fees"**, **"Tax Placement"**.
*   Sub-list: Under Fund Fees, show the **"Excess Fee Opportunity"** (e.g., "Swap VTIVX to save 8 bps on this position").

### Task 3: Experimental Integrity
*   Badge **Efficient Frontier**, **Survival Funnel**, and **Crisis Simulation** as **EXPERIMENTAL**.

---

**Does this simple, direct plan meet your requirements?** I will wait for your confirmation to execute.
