# Interactive Forensic Sankey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a standalone, interactive 2-tier Sankey diagram on the dashboard visualizing capital flow from accounts to tickers with real-time reconciliation.

**Architecture:** 
- A new `ForensicSankey.tsx` component using `d3-sankey`.
- A dedicated API endpoint `/api/portfolio/topology` to provide structured graph data.
- Dashboard integration below the main metrics.

**Tech Stack:** React (TypeScript), D3-Sankey, TailwindCSS, SQLite.

---

### Task 1: Data Backend (Topology API)

**Files:**
- Create: `src/app/api/portfolio/topology/route.ts`
- Test: `src/app/api/portfolio/topology/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**
Create a test that expects a JSON response with `nodes` and `links` from the topology endpoint.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest src/app/api/portfolio/topology/__tests__/route.test.ts`
Expected: 404 or Connection Error.

- [ ] **Step 3: Implement the topology route**
Implement the route to query `accounts`, `holdings`, and `asset_registry` to build the graph.
```typescript
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/client';

export async function GET() {
    // 1. Get Accounts
    const accounts = db.prepare('SELECT id, nickname as name FROM accounts').all() as any[];
    // 2. Get Holdings with Asset Type
    const holdings = db.prepare(`
        SELECT h.account_id, h.ticker, h.market_value as value, ar.asset_type
        FROM holdings h
        JOIN asset_registry ar ON h.ticker = ar.ticker
    `).all() as any[];

    // 3. Build Nodes & Links
    // ... logic to build unique nodes and summed links ...
    return NextResponse.json({ nodes, links });
}
```

- [ ] **Step 4: Run test to verify it passes**
Expected: PASS with structured JSON.

- [ ] **Step 5: Commit**
```bash
git add src/app/api/portfolio/topology/
git commit -m "feat: add portfolio topology API for Sankey"
```

### Task 2: ForensicSankey Component

**Files:**
- Create: `src/app/components/ForensicSankey.tsx`
- Modify: `src/app/components/SankeyChart.tsx` (if needed for shared types)

- [ ] **Step 1: Create the component structure**
Implement the `ForensicSankey` component with `d3-sankey` layout, supporting the 2-tier "Forensic Alignment" labels and click-to-reconcile logic.

- [ ] **Step 2: Implement "Account Target" reconciliation footer**
Add the sliding panel that appears on account click.

- [ ] **Step 3: Add interactive highlighting**
Implement the CSS classes for `dimmed` and `highlighted` nodes/links.

- [ ] **Step 4: Commit**
```bash
git add src/app/components/ForensicSankey.tsx
git commit -m "feat: implement Interactive ForensicSankey component"
```

### Task 3: Dashboard Integration

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add ForensicSankey to the main dashboard**
Import and place the component below the Exposure Audit section.

- [ ] **Step 2: Verify alignment and visuals**
Ensure the Sankey spans the full width and respects the jetbrains mono / text-ui styles.

- [ ] **Step 3: Commit**
```bash
git add src/app/page.tsx
git commit -m "feat: integrate ForensicSankey into dashboard"
```

### Task 4: Final Polish & Verification

- [ ] **Step 1: End-to-end browser check**
Navigate to `localhost:3000`, click an account, and verify the reconciliation footer shows matching totals.

- [ ] **Step 2: Commit final fixes**
```bash
git commit -m "fix: final polish for forensic sankey"
```
