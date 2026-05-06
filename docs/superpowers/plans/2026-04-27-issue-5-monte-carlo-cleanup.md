# Issue 5: Cleanup Monte Carlo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove orphaned Monte Carlo files to resolve build errors caused by missing dependencies.

**Architecture:** Deletion of unused API route and UI component that were left behind after the Monte Carlo implementation was removed.

**Tech Stack:** Next.js (App Router), TypeScript

---

### Task 1: Remove Orphaned Files

**Files:**
- Delete: `src/app/api/performance/montecarlo/route.ts`
- Delete: `src/app/components/SuccessFunnel.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm src/app/api/performance/montecarlo/route.ts
rm src/app/components/SuccessFunnel.tsx
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build should no longer fail with "Module not found: Can't resolve '@/lib/logic/montecarlo/evaluator'"

- [ ] **Step 3: Commit**

```bash
git add src/app/api/performance/montecarlo/route.ts src/app/components/SuccessFunnel.tsx
git commit -m "fix: remove orphaned monte carlo files to fix build"
```
