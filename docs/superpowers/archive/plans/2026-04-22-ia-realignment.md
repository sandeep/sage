# Institutional IA Realignment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move analytical widgets from Overview to Performance and replace "Efficiency Score" with a professional "Leakage Audit" focused on basis points (bps).

**Architecture:** 
1. **Overview (The Operator):** Re-layout `page.tsx` to strictly show Allocation Tree, Capital Topology, and Execution Queue.
2. **Performance (The Auditor):** Integrate `LeakageAuditV2` and `RiskWidget` (Concentration) into the performance suite.
3. **Leakage Logic:** Surface physical bps drag and annual dollar loss instead of an arbitrary score.

---

### Task 1: Overview Cleanup (The "Operator" Layout)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Remove Analytics Widgets**
Physically remove `RiskWidget`, `EfficiencyTile`, and the "Strategic Evolution" sidebar section from the home page.

- [ ] **Step 2: Restore Full-Width Layout**
Update the grid so the `MetricTable` (Allocation Tree) and `ForensicSankey` occupy the physical prominence they deserve.

---

### Task 2: Create Institutional Leakage Audit

**Files:**
- Create: `src/app/performance/LeakageAuditV2.tsx`

- [ ] **Step 1: Implement Bps-First Component**
This component will call `calculatePortfolioEfficiency()` and render:
*   **Total Structural Friction** (Bps)
*   **Tax Placement Drag** (Bps + $)
*   **Expense Ratio Drag** (Bps + $)

```typescript
// Sample visual logic
<div className="text-ui-data text-white">{efficiency.totalDragBps.toFixed(1)} bps</div>
<div className="text-ui-caption text-risk">-${fmtUSD(efficiency.dollarLoss)} / year</div>
```

---

### Task 3: Performance Page Integration

**Files:**
- Modify: `src/app/performance/page.tsx`

- [ ] **Step 1: Add Audits to Performance Suite**
Integrate `LeakageAuditV2` and `RiskWidget` immediately following the **Performance Bridge**.

---

### Task 4: Final Validation

- [ ] **Step 1: Smoke Test**
1. Overview is clean and action-oriented? ✅
2. Performance page has full analytical depth (Leakage + Concentration)? ✅
3. No console errors? ✅
