# Institutional Cost Realignment Plan

**Goal:** Transform the Performance Suite into a P&L-focused view of capital "Erosion" and physical "Structural Costs."

---

## 1. Physical P&L Vocabulary

| Fact | UI Label | Intent |
| :--- | :--- | :--- |
| Strategy Opportunity | **Strategy Potential** | Target Return |
| Asset Mix Return Gap | **Erosion: Wrong Asset Mix** | Opportunity Loss |
| Excess Product Fees | **Erosion: Excess Fund Fees** | Structural Loss |
| Tax Inefficiency | **Erosion: Wrong Tax Placement**| Structural Loss |
| Bottom Line | **Realized Return** | Physical Return |

---

## 2. Implementation Tasks

### Task 1: Performance Bridge "Erosion" Refactor
**Files:** `src/app/performance/PerformanceWaterfallClientV2.tsx`
*   Replace labels with **"Erosion: [Reason]"**.
*   Ensure "Excess Fund Fees" uses the delta between current ER and the 0 bps baseline.

### Task 2: Structural Cost Center (Replacing Drag/Leakage)
**Files:** `src/app/performance/StructuralCostCenter.tsx`
*   **Hero Metric:** "Total Annual Cost" (Sum of all structural errors in physical dollars).
*   **Box 1:** **"Excess Fund Fees"**. (Show $ loss + 8 bps swap detail).
*   **Box 2:** **"Tax Inefficiency"**. (Show $ loss + placement detail).

### Task 3: Overview "Operator" Finalization
**Files:** `src/app/page.tsx`
*   Strictly: Allocation Tree → Capital Topology → Execution Queue.

---

**Does this final architecture meet your approval?** I will wait for your confirmation to execute.
