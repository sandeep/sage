# Performance Evolution & Milestone Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Transform the target allocation and portfolio tracking into a dual-timeline historical ledger that visually proves convergence toward the Efficiency Frontier.

**Architecture:** 
1. **Historical Schema:** Add `portfolio_history` to store holdings snapshots with cached 50Y metrics.
2. **Validation Gate:** Implement a stateful ingestion UI for date verification and asset mapping.
3. **Convergence Visualization:** Refactor the Frontier Chart to plot time-series paths with aging saturation.

**Tech Stack:** TypeScript, SQLite, Recharts, better-sqlite3.

---

### Task 1: Database Hardening (Portfolio History)

**Files:**
- Create: `src/lib/db/migrations/007_portfolio_history.sql`
- Modify: `src/lib/db/migrate.ts`

 - [x] **Step 1: Create the migration file.**
```sql
CREATE TABLE IF NOT EXISTS portfolio_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date DATETIME NOT NULL,
    source TEXT NOT NULL, -- 'FIDELITY_360' | 'MANUAL'
    holdings_json TEXT NOT NULL,
    return_50y REAL NOT NULL,
    vol_50y REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_portfolio_history_date ON portfolio_history(snapshot_date);
```
 - [x] **Step 2: Apply the migration.**
Run: `npx tsx src/lib/db/migrate.ts`
Expected: Table `portfolio_history` created in `sage.db`.
 - [x] **Step 3: Commit.**
```bash
git add src/lib/db/migrations/007_portfolio_history.sql
git commit -m "db: add portfolio_history table for milestone tracking"
```

### Task 2: Milestone Ingestion & Metric Caching

**Files:**
- Create: `src/lib/logic/milestoneImporter.ts`
- Test: `src/lib/logic/__tests__/milestoneImporter.test.ts`

 - [x] **Step 1: Write the failing test for coordinate caching.**
Ensure simulation runs ONCE and results are persisted correctly.
 - [x] **Step 2: Implement the Milestone Importer.**
Logic to take a holdings map + date, calculate 50Y metrics, and save to `portfolio_history`.
 - [x] **Step 3: Run tests and verify.**
 - [x] **Step 4: Commit.**
```bash
git add src/lib/logic/milestoneImporter.ts
git commit -m "feat: implement milestone importer with metric caching"
```

### Task 3: The Ingestion "Validation Gate" (UI)

**Files:**
- Create: `src/app/components/MilestoneValidationGate.tsx`
- Modify: `src/app/components/MainImporter.tsx`

 - [x] **Step 1: Build the Validation UI.**
A modal/overlay that appears after upload, asking the user to confirm the `snapshot_date`.
 - [x] **Step 2: Implement Asset Mapping logic.**
If a ticker is unmapped in the `asset_registry`, prompt for a Simba proxy selection.
 - [x] **Step 3: Integrate with MainImporter.**
Route Fidelity 360 uploads through the gate.
 - [x] **Step 4: Commit.**
```bash
git commit -m "ui: add validation gate for historical milestone ingestion"
```

### Task 4: Convergence Visualization (Refactor Frontier)

**Files:**
- Modify: `src/app/components/PerformanceFrontier.tsx`
- Modify: `src/lib/logic/auditEngine.ts`

 - [x] **Step 1: Update auditEngine.ts.**
Fetch all historical targets and portfolio milestones. Return as `targetPath` and `portfolioPath` arrays.
 - [x] **Step 2: Refactor PerformanceFrontier.tsx.**
Plot both arrays as Scatter series. 
Implement **Time-Based Saturation**:
```typescript
const getOpacity = (idx: number, total: number) => (idx + 1) / total;
```
 - [x] **Step 3: Add Hover Details.**
Tooltip should show the date of each milestone dot.
 - [x] **Step 4: Final Validation.**
Verify that rebalances visually move the dot toward the frontier.
 - [x] **Step 5: Commit.**
```bash
git commit -m "feat: upgrade frontier chart to show convergence path"
```
