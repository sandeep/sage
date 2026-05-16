# Logic Engine & UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Fix the Yahoo API issue, upgrade the rebalancing logic to include clear "why" rationales, link BUY/SELL actions, and refactor the Task Blotter for high-signal output. Also, fix the Exposure Audit to drill down into ETF holdings.

**Architecture:** We will introduce an `issue_key` to directives to group related actions. The rebalancer will now generate these keys based on the category drift. The Task Blotter will group by this key and display the rationale prominently. The Yahoo API fetcher will be updated to handle rate limits/blocks more gracefully.

**Tech Stack:** Next.js, SQLite, TypeScript.

---

## Chunk 1: Yahoo API Fix (Systematic Debugging)

**Goal:** Resolve the "Unauthorized" / "Invalid Crumb" issues.

**Files:**
- Modify: `src/lib/data/refresh.ts`

- [x] **Step 1: Implement a crumb-free price lookup fallback**
Yahoo's `/v8/finance/chart` endpoint is often less restricted than `/v7/finance/quote`. We already use it for history, let's use it for the current price too.

- [x] **Step 2: Add random delay between batch requests**
To avoid 429s, increase `BATCH_DELAY_MS` and add a small random jitter.

- [x] **Step 3: Add retry logic with exponential backoff**

---

## Chunk 2: Rebalancer Logic Upgrade

**Goal:** Link related actions and provide clear rationales.

**Files:**
- Modify: `src/lib/db/schema.sql`
- Modify: `src/lib/db/migrate.ts`
- Modify: `src/lib/logic/rebalancer.ts`

- [x] **Step 1: Add `link_key` to directives**
Update schema and migration to add a `link_key` column to the `directives` table.

- [x] **Step 2: Update rebalancer to group actions**
The rebalancer should now identify "Issues" (e.g., "Overweight in US Stocks") and generate both the SELL and BUY actions using the same `link_key`.

- [x] **Step 3: Enhance `reasoning` field**
Make it descriptive: "Portfolio is 17% overweight in US Large Cap. Selling excess to fund Emerging Markets gap."

---

## Chunk 3: Task Blotter UI Refactor

**Goal:** High-signal display, group by issue, remove noise.

**Files:**
- Modify: `src/app/components/TaskBlotter.tsx`

- [x] **Step 1: Remove "Window X" boilerplate**
- [x] **Step 2: Group directives by `link_key`**
Display the issue rationale once at the top of the group, followed by the specific BUY/SELL tasks.
- [x] **Step 3: Add "Why?" button or expansion for detailed reasoning**

---

## Chunk 4: Exposure Audit (ETF Drill-down)

**Goal:** Surface true concentration risk by looking through ETF wrappers.

**Files:**
- Modify: `src/lib/logic/xray.ts`

- [x] **Step 1: Update `getConcentrationRisks` to use `etf_composition`**
Instead of just tickers, it should calculate "True Concentration" by summing direct stock value + (ETF value * ETF weight for that stock).
- [x] **Step 2: Update RiskWidget to show "Derived Exposure" rationale**
Example: "NVDA: 8% (Direct: 2%, via VTI: 6%)"
