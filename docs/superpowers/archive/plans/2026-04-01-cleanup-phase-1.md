# Phase 1: Dashboard Architecture & Decomposition Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move heavy SQL/mapping logic from `src/app/page.tsx` to a library service and split large files (>258 lines) into smaller, focused components.

**Architecture:** 
- `src/lib/logic/dashboardService.ts`: New service for dashboard data fetching.
- Decomposed components for `AllocationEditor` and `ForensicSankey`.

**Tech Stack:** Next.js Server Components, Better-SQLite3, React.

---

### Task 1: Create Dashboard Service

**Files:**
- Create: `src/lib/logic/dashboardService.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Extract topology and metrics logic**
Move the database queries and object mapping from `Home()` in `page.tsx` into `getDashboardData()`.
```typescript
export async function getDashboardData() {
    // Move SQL queries for accounts, holdings, directives here
    return { hierarchicalMetrics, allDirectives, topologyData, alphaScore, efficiency };
}
```

- [ ] **Step 2: Update Home component**
Refactor `src/app/page.tsx` to call `getDashboardData()` and pass results to sub-components.

- [ ] **Step 3: Commit**
```bash
git add src/lib/logic/dashboardService.ts src/app/page.tsx
git commit -m "refactor: extract dashboard logic to service layer"
```

### Task 2: Decompose AllocationEditor (345 lines)

**Files:**
- Create: `src/app/components/Allocation/AllocationNodeRow.tsx`
- Create: `src/app/components/Allocation/AllocationHeader.tsx`
- Modify: `src/app/components/AllocationEditor.tsx`

- [ ] **Step 1: Extract Header and Row components**
Move the complex row rendering and header controls into standalone files.

- [ ] **Step 2: Simplify main Editor**
Update `AllocationEditor.tsx` to use the new components, bringing it well under 250 lines.

- [ ] **Step 3: Commit**
```bash
git add src/app/components/Allocation/ src/app/components/AllocationEditor.tsx
git commit -m "refactor: decompose AllocationEditor into smaller units"
```

### Task 3: Decompose ComparisonEngine (375 lines)

**Files:**
- Create: `src/lib/logic/comparison/metricCalculators.ts`
- Modify: `src/lib/logic/comparisonEngine.ts`

- [ ] **Step 1: Extract individual metric math**
Move logic for Sharpe, Sortino, and TWR into `metricCalculators.ts`.

- [ ] **Step 2: Commit**
```bash
git add src/lib/logic/comparison/ src/lib/logic/comparisonEngine.ts
git commit -m "refactor: decompose comparisonEngine"
```
