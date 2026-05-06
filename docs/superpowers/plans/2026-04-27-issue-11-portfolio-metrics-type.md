# Issue 11: Fix PortfolioMetrics Type Usage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve build-time TypeScript errors in `src/lib/logic/comparisonEngine.ts` by using the correct property name from the `PortfolioMetrics` interface.

**Architecture:** Updating internal logic to consistently use `annualReturns` as defined in the interface.

**Tech Stack:** TypeScript

---

### Task 1: Update Property Usage

**Files:**
- Modify: `src/lib/logic/comparisonEngine.ts`

- [ ] **Step 1: Replace actualReturns with annualReturns**

```typescript
// src/lib/logic/comparisonEngine.ts

// Change from:
actual: actualMetrics ? computeCrisisDrawdown(actualMetrics.actualReturns || actualMetrics.annualReturns, p.years, false, p.name, actualMetrics.volatility, vtiMetrics?.volatility || null) : null,

// To:
actual: actualMetrics ? computeCrisisDrawdown(actualMetrics.annualReturns, p.years, false, p.name, actualMetrics.volatility, vtiMetrics?.volatility || null) : null,
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build should no longer fail with "Property 'actualReturns' does not exist" in `src/lib/logic/comparisonEngine.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/logic/comparisonEngine.ts
git commit -m "fix: use correct property name in comparison engine"
```
