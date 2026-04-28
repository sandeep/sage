# Performance Grid Precision Plan

**Goal:** Physically separate M2 and Alpha into distinct columns and clarify their meaning for high-performance auditing.

---

## 1. Physical Grid Realignment

| NEW Column | Institutional Meaning | Rendering Logic |
| :--- | :--- | :--- |
| **Risk-Adj. Lead** | M2 Measure: Return premium over VTI if risks were equal. | High-Contrast Emerald/Rose. |
| **Selection Alpha**| Manager Skill: Return premium over Strategy risk-adjusted expectation. | Only visible in **Portfolio Realization**. |

---

## 2. Implementation Tasks

### Task 1: Refactor Grid Columns
**Files:** `src/app/performance/PerformanceGridClientV2.tsx`
*   Physically split the `M2 · Alpha` headers into two separate `<th>` elements.
*   Update the table body to use two distinct `<td>` cells for these metrics.
*   **Precision:** Maintain the **1-decimal place** standard.

### Task 2: Implement "Selection Alpha" Guard
*   **Strategy Potential:** Hide the Alpha column or show "—" (since a target has no selection skill).
*   **Portfolio Realization:** Show the physical Alpha (e.g. 0.1% or -0.5%).

---

**Does this physical separation meet your requirements?** I will wait for your confirmation to execute.
