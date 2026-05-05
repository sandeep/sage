# Issue 8: Fix Alpha Metrics Arguments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve build-time TypeScript errors in `src/app/active/page.tsx` by removing unsupported arguments from alpha metric function calls.

**Architecture:** Aligning component-level calls with the current signatures of the logic layer functions.

**Tech Stack:** TypeScript, Next.js

---

### Task 1: Update Function Calls

**Files:**
- Modify: `src/app/active/page.tsx`

- [ ] **Step 1: Remove unsupported arguments**

```typescript
// src/app/active/page.tsx

// Change from:
const metrics = await calculateAlphaMetrics(startDate, endDate);
const bookStats = await getBookTradeStats(startDate, endDate);
const alphaNavSeries = await getAlphaNavSeries(startDate, endDate);

// To:
const metrics = await calculateAlphaMetrics();
const bookStats = await getBookTradeStats();
const alphaNavSeries = await getAlphaNavSeries();
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build should no longer fail with "Expected 0 arguments, but got 2" in `src/app/active/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/active/page.tsx
git commit -m "fix: remove unsupported arguments from alpha metric calls"
```
