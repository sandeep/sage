# Implementation Plan: Forensic Audit Pane (v4.0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a sliding side-panel in the Execution Desk that allows users to click any strategic move and visually audit the data trail (historic snapshot comparisons) that produced the recommendation.

**Architecture:** 
1.  **Data Service**: A new backend service (`auditService.ts`) to fetch historic snapshots for a given asset class or ticker.
2.  **State Management**: Add `selectedRow` state to `TaskBlotter.tsx` to handle row clicks.
3.  **UI Component**: A new `ForensicAuditPane.tsx` component that slides in from the right, displaying a 3-column "Data Trail" (Baseline, Current, Reasoning).

**Tech Stack:** TypeScript, React, SQLite, Tailwind CSS.

---

### Task 1: Audit Data Service

**Files:**
- Create: `src/lib/logic/auditService.ts`

- [ ] **Step 1: Create the service**
Implement `getAuditTrail(assetClassOrTicker: string)`. Query the `snapshots` table for the last 3 time-buckets and map the historical holdings.

```typescript
// src/lib/logic/auditService.ts
import db from '../db/client';

export interface AuditSnapshot {
    date: string;
    market_value: number;
}

export function getAuditTrail(identifier: string): AuditSnapshot[] {
    return db.prepare(`
        SELECT date, SUM(market_value) as market_value
        FROM snapshots 
        WHERE ticker = ? OR asset_class = ?
        GROUP BY date
        ORDER BY date DESC 
        LIMIT 3
    `).all(identifier, identifier) as AuditSnapshot[];
}
```

---

### Task 2: State-Aware TaskBlotter

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

- [ ] **Step 1: Add Selection State**
Add state to track the selected row: `const [selectedMove, setSelectedMove] = useState<StrategicMoveRow | null>(null);`

- [ ] **Step 2: Wire Row Click Event**
Update the sticky column `td` (or the whole `tr`) to handle clicks: `onClick={() => setSelectedMove(row)}`. Ensure the cursor indicates interactivity (`cursor-pointer`).

- [ ] **Step 3: Integrate the Pane**
Import and render the `ForensicAuditPane` component, passing `selectedMove` and a `onClose={() => setSelectedMove(null)}` callback.

---

### Task 3: The Forensic Audit UI Component

**Files:**
- Create: `src/app/components/ForensicAuditPane.tsx`

- [ ] **Step 1: Build the Slide-Over Shell**
Create a fixed-position overlay (`fixed inset-y-0 right-0 w-[400px] bg-zinc-950 border-l border-zinc-800 z-50 transform transition-transform`).

- [ ] **Step 2: Implement the Data Fetching Hook**
Use React's `useEffect` or SWR to fetch data from a new API route (which we will create in Step 3) using the `auditService`.

- [ ] **Step 3: Build API Route**
Create `src/app/api/audit/route.ts` to expose `getAuditTrail` to the frontend.

```typescript
// src/app/api/audit/route.ts
import { NextResponse } from 'next/server';
import { getAuditTrail } from '@/lib/logic/auditService';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    return NextResponse.json(getAuditTrail(id));
}
```

- [ ] **Step 4: Render the "Data Trail"**
Display the fetched snapshots and the reasoning from the `selectedMove.cells`. Show "Baseline", "Current", and "The Why".

---

### Task 4: Verification

- [ ] **Step 1: E2E Integration Check**
Run `npm run build` to verify type safety. 

- [ ] **Step 2: Manual UI Audit**
Verify in the browser that clicking a row in the Execution Desk opens the side panel, fetches the historical data, and correctly displays the forensic trail.
