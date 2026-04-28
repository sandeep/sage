# Phase 3: Accessibility & Layout Stability Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add proper ARIA labels and focus indicators to interactive elements, and fix layout shifts in the sidebar.

---

### Task 1: Accessibility Hardening

**Files:**
- Modify: `src/app/components/ForensicSankey.tsx`
- Modify: `src/app/components/MetricTable.tsx`

- [ ] **Step 1: Add ARIA and Focus**
Add `tabIndex={0}`, `role="button"`, and `aria-label` to interactive nodes.

- [ ] **Step 2: Commit**
```bash
git add .
git commit -m "a11y: add focus indicators and ARIA labels"
```

### Task 2: Layout Stability

**Files:**
- Modify: `src/app/components/EfficiencyTile.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Implement fixed-height containers**
Ensure sidebar elements have a stable layout to prevent jumping during hydration.

- [ ] **Step 2: Commit**
```bash
git add .
git commit -m "style: stabilize dashboard sidebar layout"
```
