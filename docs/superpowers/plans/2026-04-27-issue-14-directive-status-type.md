# Issue 14: Harmonize Directive Status Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve build-time TypeScript errors in `src/app/passive/portfolio/page.tsx` by standardizing the `status` field type across logic and UI layers.

**Architecture:** Defining a shared type for `DirectiveStatus` to ensure consistency.

**Tech Stack:** TypeScript

---

### Task 1: Update Directive Status Type in Logic Layer

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`

- [ ] **Step 1: Define and use DirectiveStatus type**

```typescript
// src/lib/logic/rebalancer.ts
export type DirectiveStatus = 'PENDING' | 'ACCEPTED' | 'SNOOZED' | 'EXECUTED';

export interface Directive {
    id: number;
    // ...
    status: DirectiveStatus; // Changed from status?: string
    // ...
}
```

---

### Task 2: Update TaskBlotter to use shared type

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

- [ ] **Step 1: Use imported DirectiveStatus type**

```typescript
// src/app/components/TaskBlotter.tsx
import { Directive as LogicDirective, DirectiveStatus } from '@/lib/logic/rebalancer';

interface Directive extends LogicDirective {
    id: number;
    status: DirectiveStatus;
}
```

---

### Task 3: Verify and Commit

- [ ] **Step 1: Verify build**

Run: `npm run build`
Expected: Build should finally pass completely.

- [ ] **Step 2: Commit**

```bash
git add src/lib/logic/rebalancer.ts src/app/components/TaskBlotter.tsx
git commit -m "fix: harmonize Directive status types"
```
