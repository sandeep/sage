# Issue 13: Fix Directive ID Mandatory Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve build-time TypeScript errors in `src/app/passive/portfolio/page.tsx` by making the `id` field mandatory in the logic layer's `Directive` interface to match UI requirements.

**Architecture:** Standardizing the core `Directive` type to reflect the reality that persisted directives always have a database-generated ID.

**Tech Stack:** TypeScript

---

### Task 1: Update Directive Interface

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`

- [ ] **Step 1: Make id mandatory**

```typescript
// src/lib/logic/rebalancer.ts
export interface Directive {
    id: number; // Changed from id?: number
    type: 'SELL' | 'BUY' | 'REBALANCE' | 'OPTIMIZATION' | 'PLACEMENT';
    // ...
```

---

### Task 2: Verify and Commit

- [ ] **Step 1: Verify build**

Run: `npm run build`
Expected: Build should no longer fail with "Types of property 'id' are incompatible" in `src/app/passive/portfolio/page.tsx`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/logic/rebalancer.ts
git commit -m "fix: make Directive id mandatory to match UI expectations"
```
