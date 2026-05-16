# Holdings UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Redesign the holdings page to aggregate by ticker (showing total exposure), expand each row to show per-account detail, and display human-readable account names.

**Architecture:** The holdings page switches from a flat row-per-holding query to a two-level structure: aggregate ticker rows (server-rendered) with expandable account sub-rows (client-side expand/collapse from pre-loaded data). Account nicknames are added to the `accounts` table and editable in AccountMapper.

**Tech Stack:** Next.js 15, better-sqlite3, React (client component for expand/collapse), vitest.

**Dependency note:** Task 1 of the Asset Registry plan (Plan A) adds `accounts.nickname` and `holdings.market_value` via `migrate.ts`. If Plan A runs concurrently, verify those columns exist before starting Task 2 of this plan. If running this plan standalone, the migration in Task 1 here is self-contained.

---

## Chunk 1: Schema & Account Nickname

### Task 1: Add nickname to accounts (schema migration)

**Files:**
- Modify: `src/lib/db/migrate.ts` (create if not exists)
- Modify: `src/lib/db/client.ts`

> **Note:** If Plan A (Asset Registry) is running concurrently, it creates `migrate.ts` and calls `runMigrations()`. If this plan runs first or standalone, create `migrate.ts` yourself. The ALTER TABLE statements are idempotent — safe to include in both.

- [x] **Step 1: Create or update migrate.ts**
- [x] **Step 2: Call migrations in client.ts**
- [x] **Step 3: Verify columns exist**
- [x] **Step 4: Commit**

### Task 2: Add nickname to AccountMapper and API

**Files:**
- Modify: `src/app/components/AccountMapper.tsx`
- Modify: `src/app/api/accounts/route.ts`

- [x] **Step 1: Read both files first**
- [x] **Step 2: Add nickname field to AccountMapper form**
- [x] **Step 3: Update /api/accounts route**
- [x] **Step 4: Verify AccountMapper renders with nickname field**
- [x] **Step 5: Commit**

---

## Chunk 2: Holdings Aggregated View

### Task 3: Rewrite holdings page with ticker aggregation

**Files:**
- Rewrite: `src/app/holdings/page.tsx`

- [x] **Step 1: Read the current holdings page**
- [x] **Step 2: Write the new holdings page**
- [x] **Step 3: Create HoldingsTable client component**
- [x] **Step 4: Verify the holdings page renders correctly**
- [x] **Step 5: Commit**
