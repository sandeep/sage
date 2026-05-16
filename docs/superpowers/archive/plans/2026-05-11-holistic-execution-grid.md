# Implementation Plan: Holistic Execution Grid (Rebalancer v3.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a 2D matrix UI that groups Strategic Moves by row and Physical Accounts by column, providing a unified "Execution Desk" experience.

**Architecture:** 
1.  **Matrix Pivot**: Transform the flat `directives` array into a data structure where each row is a strategic goal.
2.  **Sticky Layout**: Use Tailwind's `sticky` utilities for the left-hand goal column and horizontal scrolling for account pillars.
3.  **Actionable Cells**: Refactor the trade cards into a high-density grid.

**Tech Stack:** React, Tailwind, Next.js.

---

### Task 1: Data Transformation (The Matrix Pivot)

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

- [ ] **Step 1: Define Matrix Interfaces**

```typescript
interface TradeCell {
    account_id: string;
    directives: Directive[];
}

interface StrategicMoveRow {
    goal: string;
    totalAmount: number;
    cells: Record<string, TradeCell>; // Keyed by account_id
    status: 'SYNCHRONIZED' | 'IN_PROGRESS' | 'ACTIONABLE';
}
```

- [ ] **Step 2: Implement Pivot Logic**
Group directives by `asset_class` or `link_key`. Extract unique `account_id`s to form columns.

- [ ] **Step 3: Verification**
Add a console log to verify the pivoted structure correctly groups multiple accounts under one asset class.

---

### Task 2: Sticky Grid UI Layout

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

- [ ] **Step 1: Implement Scrollable Container**
Use `overflow-x-auto` for the table and `sticky left-0` for the Strategic Move column.

- [ ] **Step 2: Render Account Headers**
Generate column headers using `account_nickname` and `account_provider`.

- [ ] **Step 3: Render Row Headers**
Display the Goal name and Total Notional in the sticky left column.

---

### Task 3: Trade Cell Implementation

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

- [ ] **Step 1: Create Mini Trade Cards**
Implement high-density "BUY/SELL" labels and ticker/amount display for the table cells.

- [ ] **Step 2: Wire Action Buttons**
Ensure "Accept" and "Mark Executed" update the correct directive ID within the grid.

---

### Task 4: Holistic Portfolio Integration

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`
- Modify: `src/app/passive/portfolio/page.tsx`

- [ ] **Step 1: Pass Metrics to Blotter**
Update the parent page to pass `hierarchicalMetrics` to the component.

- [ ] **Step 2: Render Equilibrium Rows**
For metrics with no associated directives, render a muted "Synchronized" row to provide full strategic context.

---

### Task 5: Final Verification

- [ ] **Step 1: Build Check**
Run `npm run build`.

- [ ] **Step 2: Manual UI Audit**
Verify horizontal scrolling and sticky headers in the browser.
