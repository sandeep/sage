# Unified Portfolio Ledger (Time-Machine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Transform the static `holdings` table into an append-only `holdings_ledger` to preserve immutable portfolio history, while using a Database View to maintain backward compatibility for existing features.

**Architecture:** 
1. **The Ledger:** Create `holdings_ledger` with a `snapshot_date` column.
2. **The View:** Replace the current `holdings` table with a SQL View that returns the latest snapshot.
3. **The API:** Update `/api/upload` to perform append-only inserts.
4. **The UI:** Add a `Snapshot Date` input to the Main Importer.

**Tech Stack:** SQLite, Next.js (Server Actions), TypeScript.

---

### Task 1: Database Hardening (The Migration)

**Files:**
- Modify: `src/lib/db/migrate.ts`
- Modify: `src/lib/db/client.ts`

 - [x] **Step 1: Create the Ledger Table.**
```sql
CREATE TABLE IF NOT EXISTS holdings_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL, -- YYYY-MM-DD
    account_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    quantity REAL NOT NULL,
    cost_basis REAL,
    asset_type TEXT NOT NULL,
    market_value REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON holdings_ledger(snapshot_date);
```
 - [x] **Step 2: Migrate Existing Data.**
Copy all rows from `holdings` to `holdings_ledger` using `datetime('now', 'localtime')` as the snapshot date.
 - [x] **Step 3: Establish the "Source of Truth" View.**
Drop the old `holdings` table and create the view:
```sql
CREATE VIEW holdings AS 
SELECT * FROM holdings_ledger 
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM holdings_ledger);
```
 - [x] **Step 4: Commit.**
```bash
git commit -m "feat: implement unified portfolio ledger and source-of-truth view"
```

### Task 2: Append-Only Ingestion

**Files:**
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/lib/ingest/index.ts`

 - [x] **Step 1: Update API Handler.**
Accept an optional `snapshotDate` in the POST body. Default to current date.
 - [x] **Step 2: Refactor Ingest Logic.**
Remove `DELETE FROM holdings` logic. Ensure the ingestion loop writes to `holdings_ledger` instead.
 - [x] **Step 3: Commit.**
```bash
git commit -m "feat: refactor ingestion API for append-only ledger history"
```

### Task 3: UI Enhancement (The Date Gate)

**Files:**
- Modify: `src/app/components/MainImporter.tsx`

 - [x] **Step 1: Add Date Input.**
Inject a `Snapshot Date` field next to the "Upload" button.
 - [x] **Step 2: Visual Feedback.**
Show a small "History Recorded" toast or indicator after successful append.
 - [x] **Step 3: Commit.**
```bash
git commit -m "feat: add snapshot date control to portfolio importer"
```

### Task 4: Final Validation

 - [x] **Step 1: Verify Dashboard Stability.**
Ensure the main dashboard and rebalancer still function correctly (using the View).
 - [x] **Step 2: Verify Immutable History.**
Upload a sample "Past File" and confirm the "Evolution Chart" sees the new dot.
 - [x] **Step 3: Final Build.**
```bash
npm run build
```
