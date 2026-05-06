# Issue 9: Fix Directive Type Mismatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harmonize the `Directive` interface across the logic, service, and UI layers to resolve build-time TypeScript errors.

**Architecture:** Standardizing on a single `Directive` type and ensuring data fetching layers provide the necessary fields.

**Tech Stack:** TypeScript, Next.js

---

### Task 1: Standardize Directive Type in Logic Layer

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`

- [ ] **Step 1: Make tranche fields mandatory or default to 1**

Update the `Directive` interface to match the UI expectations, or ensure the UI can handle optional fields. Given `TaskBlotter` expects them, we'll make them mandatory in the logic layer as well, with defaults during creation.

```typescript
// src/lib/logic/rebalancer.ts
export interface Directive {
    id?: number;
    type: 'SELL' | 'BUY' | 'REBALANCE' | 'OPTIMIZATION' | 'PLACEMENT';
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    reasoning: string;
    link_key: string;
    status?: string;
    account_id?: string;
    asset_class?: string;
    scheduled_date?: string;
    tranche_index: number;
    tranche_total: number;
    amount?: number;
}
```

---

### Task 2: Update Data Fetching in Dashboard Service

**Files:**
- Modify: `src/lib/logic/dashboardService.ts`

- [ ] **Step 1: Update the query and casting**

```typescript
// src/lib/logic/dashboardService.ts
import { generateDirectives, Directive } from './rebalancer';

// ... inside getDashboardData
const allDirectives = db.prepare("SELECT * FROM directives").all() as Directive[];
```

---

### Task 3: Update TaskBlotter to handle optional status correctly

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

- [ ] **Step 1: Update UI Directive interface to match logic**

```typescript
// src/app/components/TaskBlotter.tsx
import { Directive as LogicDirective } from '@/lib/logic/rebalancer';

// Use a shared type or ensure they match
interface Directive extends LogicDirective {
    id: number;
    status: 'PENDING' | 'ACCEPTED' | 'SNOOZED' | 'EXECUTED';
}
```

---

### Task 4: Verify and Commit

- [ ] **Step 1: Verify build**

Run: `npm run build`
Expected: Build should no longer fail with "Type ... is not assignable to type 'Directive[]'" in `src/app/passive/portfolio/page.tsx`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/logic/rebalancer.ts src/lib/logic/dashboardService.ts src/app/components/TaskBlotter.tsx
git commit -m "fix: harmonize Directive types across layers"
```
