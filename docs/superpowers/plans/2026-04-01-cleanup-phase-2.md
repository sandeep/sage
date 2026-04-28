# Phase 2: Zero-Slop UX & Theme Normalization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove redundant UI "slop", standardize dashboard section headers, and migrate hard-coded hex colors to semantic CSS variables.

**Architecture:** 
- Unified `DashboardSection` wrapper for layout consistency.
- CSS Variable migration for charts and components.

---

### Task 1: Slop Removal & Header Standardization

**Files:**
- Create: `src/app/components/Dashboard/DashboardSection.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/components/ForensicSankey.tsx`
- Modify: `src/app/components/RiskWidget.tsx`

- [ ] **Step 1: Create DashboardSection component**
Define a standard wrapper with consistent padding, border-b, and typography for section headers.

- [ ] **Step 2: Remove redundant slop**
- Delete "Integrity Verified" and "Reconciliation Error" badges from `ForensicSankey.tsx`.
- Remove "STATUS: NOMINAL" text from `RiskWidget.tsx`.

- [ ] **Step 3: Refactor page.tsx headers**
Replace manual header divs with `<DashboardSection />`.

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "fix: remove UX slop and standardize section headers"
```

### Task 2: Theme Token Migration

**Files:**
- Modify: `src/app/components/ForensicSankey.tsx`
- Modify: `src/app/components/AllocationChart.tsx`
- Modify: `src/app/components/NavChart.tsx`

- [ ] **Step 1: Replace hard-coded hex colors**
Migrate `#10b981` → `var(--accent)`, `#f43f5e` → `var(--risk)`, etc., using CSS variables defined in `globals.css`.

- [ ] **Step 2: Commit**
```bash
git add .
git commit -m "style: normalize theme tokens across components"
```
