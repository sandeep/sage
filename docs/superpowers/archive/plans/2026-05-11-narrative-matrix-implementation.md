# Implementation Plan: Narrative Execution Matrix (Rebalancer v3.2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Narrative Grid" where rows explicitly state the Source/Target and Current/Target state of every strategic move.

**Architecture:** 
1.  **Metadata Injection**: Update the engine to track and save the "Source" of every trade.
2.  **Narrative Logic**: Refactor the UI to generate "From → To" headlines.
3.  **Visual Delta**: Redesign the sticky left column to show the `$5k → $32k` shift.

**Tech Stack:** TypeScript, Next.js, SQLite.

---

### Task 1: Engine Evolution (Source Tracking)

**Files:**
- Modify: `src/lib/logic/rebalance/islandEngine.ts`
- Modify: `src/lib/logic/rebalancer.ts`
- Modify: `src/lib/db/migrate.ts`

- [ ] **Step 1: Update DB Schema**
Add `source_asset_class` and `target_asset_class` to the `directives` table.

```sql
ALTER TABLE directives ADD COLUMN source_asset_class TEXT;
ALTER TABLE directives ADD COLUMN target_asset_class TEXT;
```

- [ ] **Step 2: Update `islandEngine.ts`**
In `solveIslands`, when a swap is created, set the `source_asset_class` to the overweight category and `target_asset_class` to the shortfall category.

- [ ] **Step 3: Update `rebalancer.ts`**
Ensure the `Directive` interface and the persistence logic handle these new fields.

---

### Task 2: Narrative UI Logic

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

- [ ] **Step 1: Refactor Grouping Key**
Instead of grouping by `link_key`, group by a composite key: `${source_asset_class}_to_${target_asset_class}`.

- [ ] **Step 2: Implement Narrative Headline Generator**
Write a helper function to create the display title:
- Rebalance: `Total Stock → Emerging Markets`
- Optimize: `Fee Optimization: [Ticker]`
- Liquidate: `Excess [Class] → Cash`

---

### Task 3: The Strategic Shift Card (Left Column)

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

- [ ] **Step 1: Calculate Total State Change**
In each row, find the matching metric from the `hierarchicalMetrics` prop.

- [ ] **Step 2: Render the "Shift" UI**
In the sticky left column, show:
- Current Value ($5k)
- Target Value ($32k)
- Delta (+$27k)
- Muted progress bar from current to target.

---

### Task 4: Verification

- [ ] **Step 1: Build & UI Audit**
Run `npm run build`. Verify that the left column now tells a complete "From → To" story and correctly shows the dollar shift.
