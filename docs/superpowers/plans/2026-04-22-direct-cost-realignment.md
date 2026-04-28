# Institutional IA & Direct Cost Realignment Plan

**Goal:** Synchronize the Performance Suite with direct financial terminology ("Drag" and "Excess") and unify the mathematical story across the Bridge and Audit sections.

---

## 1. Terminology Standardization (The Dictionary)

| Physical Fact | UI Label | Component |
| :--- | :--- | :--- |
| Asset Mix Return Gap | **Strategic Drift** | Performance Bridge |
| Sum of ER + Tax Inefficiency | **Total Drag** | Performance Bridge, Drag Audit |
| Weighted Fund Fees | **Portfolio Expense Ratio** | Drag Audit |
| Tax Placement Loss | **Tax Location Drag** | Drag Audit |
| Specific Fund Potential Savings | **Excess Expense Ratio** | Drag Audit (Drill-down) |

---

## 2. Implementation Tasks

### Task 1: Performance Bridge Synchronization
**Files:** `src/app/performance/PerformanceWaterfallClientV2.tsx`
*   Update labels to **"Strategic Drift"** and **"Total Drag"**.
*   Ensure the 7 bps "Total Drag" is calculated as the sum of Fee + Tax components.

### Task 2: Drag Audit Component (Replacing Leakage Audit)
**Files:** `src/app/performance/DragAuditV2.tsx` (Renamed from LeakageAudit)
*   Header: **"Drag Audit"**. Subtitle: **"Portfolio expense and tax location drag"**.
*   Hero Boxes: **"Total Drag"**, **"Portfolio Expense Ratio"**, **"Tax Location Drag"**.
*   Sub-list: Under Expense Ratio, show the **"Excess Expense Ratio"** opportunities (e.g., "Reduce Excess ER by 8 bps by swapping VTIVX").

### Task 3: Experimental Integrity
*   Badge **Efficient Frontier**, **Survival Funnel**, and **Crisis Simulation** as **EXPERIMENTAL**.

---

**Does this final wording and plan meet your requirements?** I will wait for your confirmation to execute.
