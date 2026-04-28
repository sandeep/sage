# Performance Page UI Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize all tables and components on the Performance page to a single high-integrity design system. Ensure mathematical logic is preserved while fixing inconsistent font sizes, unreadable grays, and layout slop.

**Architecture:** 
- `globals.css`: Define standard UI aliases.
- Component refactors for all 6 major tables.
- Standardized padding (`px-10 py-6` headers, `px-10 py-5` rows).

**Tech Stack:** React, TailwindCSS, Next.js.

---

### Task 1: Design Token Hardening

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Alias UI classes**
Explicitly map the `ui-` classes used in components to the `text-ui-` utilities defined in the design system.
```css
.ui-hero { @apply text-ui-hero; }
.ui-header { @apply text-ui-header; }
.ui-metric { @apply text-ui-data; }
.ui-label { @apply text-ui-label; }
.ui-caption { @apply text-ui-caption; }
.ui-value { @apply text-ui-body; }
```

- [ ] **Step 2: Commit**
```bash
git add src/app/globals.css
git commit -m "style: harden design tokens and alias UI classes"
```

### Task 2: Standardize Institutional Horizon Audit

**Files:**
- Modify: `src/app/performance/PerformanceGridV2.tsx`

- [ ] **Step 1: Refactor Table Spacing & Fonts**
Apply `px-10` padding to all cells. Ensure headers use `ui-label` and data uses `ui-value`.
Replace hardcoded `text-zinc-500` with `text-meta`.

- [ ] **Step 2: Commit**
```bash
git add src/app/performance/PerformanceGridV2.tsx
git commit -m "style: normalize Institutional Horizon Audit table"
```

### Task 3: Standardize Resilience Audit & Crisis Table

**Files:**
- Modify: `src/app/performance/ResilienceAuditV2.tsx`
- Modify: `src/app/performance/CrisisStressTableV2.tsx`

- [ ] **Step 1: Unify Headers**
Ensure section headers use the 18px `ui-header` token.

- [ ] **Step 2: Standardize Crisis Table Rows**
Align `CrisisStressTableV2.tsx` padding and font sizes to match the Horizon Audit standard.

- [ ] **Step 3: Commit**
```bash
git add src/app/performance/ResilienceAuditV2.tsx src/app/performance/CrisisStressTableV2.tsx
git commit -m "style: normalize Resilience Audit and Crisis Table"
```

### Task 4: Fix Comparison Metric Grid (Long-Run)

**Files:**
- Modify: `src/app/performance/ComparisonMetricGridV2.tsx`

- [ ] **Step 1: Convert Flex-Rows to Table**
Refactor the custom flex-based rows to a standard `<table>` structure so it aligns horizontally with other components on the page.

- [ ] **Step 2: Commit**
```bash
git add src/app/performance/ComparisonMetricGridV2.tsx
git commit -m "style: standardize comparison metric grid layout"
```

### Task 5: Final Verification & Polish

- [ ] **Step 1: Check Labels**
Verify no titles were changed. Ensure "Settings" and "Sync Fidelity 360 Data" labels are intact.

- [ ] **Step 2: Build & Verify**
Run `npm run build`.
```bash
npm run build
```
