# Issue 12: Fix Missing Directive Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve build-time TypeScript errors in `src/lib/logic/dashboardService.ts` by importing the `Directive` type.

**Architecture:** Ensuring type visibility between modules.

**Tech Stack:** TypeScript

---

### Task 1: Add Missing Import

**Files:**
- Modify: `src/lib/logic/dashboardService.ts`

- [ ] **Step 1: Add Directive to imports**

```typescript
// src/lib/logic/dashboardService.ts
import { generateDirectives, Directive } from './rebalancer';
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build should no longer fail with "Cannot find name 'Directive'" in `src/lib/logic/dashboardService.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/logic/dashboardService.ts
git commit -m "fix: add missing Directive import in dashboard service"
```
