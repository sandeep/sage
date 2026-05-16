# Allocation DB Migration + FMP Data Refresh + Explorer UI

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Move target allocation from a static JSON import to a SQLite-backed normalized table with full version history. Replace Yahoo Finance with Financial Modeling Prep (FMP) for prices, metadata, and ETF look-through data. Build an interactive Allocation Explorer with slider-based simulation and Before/After comparison.

**Architecture:**
- `allocation_nodes` — live, mutable. One row per category node. This is what `xray.ts` and `rebalancer.ts` read.
- `allocation_versions` — append-only history. A snapshot (JSON blob) is written here every time the user accepts a new allocation. For display and audit only.
- `etf_composition` — populated once per ETF fund ticker via FMP `/v3/etf-holder/{symbol}`. Re-fetched only when stale (no `fetched_at` or older than 90 days).
- `target_allocation.json` — remains as bootstrap seed only (idempotent INSERT OR IGNORE).

**Dependencies:** Chunk 1 must complete before Chunk 2 or 3. Chunk 2 and 3 are independent and can run in parallel.

**Tech Stack:** Next.js 15, TypeScript, better-sqlite3, FMP REST API, Tailwind CSS, vitest.

**API Keys (in .env.local):**
- `FINANCIAL_MODELING_PREP_API_KEY` — primary source for ETF holdings, profiles, prices
- `ALPHA_VANTAGE_API_KEY` — fallback for price history

---

## Chunk 1: DB Schema + Allocation Migration

**Goal:** Add `allocation_nodes` and `allocation_versions` tables. Seed from JSON. Update all logic to read from DB.

### Task 1: Schema + migration

**Files:**
- Modify: `src/lib/db/schema.sql`
- Modify: `src/lib/db/migrate.ts`

- [x] **Step 1: Add new tables to schema.sql**

```sql
-- Live allocation nodes (replaces target_allocation.json reads)
CREATE TABLE IF NOT EXISTS allocation_nodes (
    label           TEXT PRIMARY KEY,
    parent_label    TEXT,               -- NULL for top-level (Stock, Bond, Cash)
    weight          REAL NOT NULL,
    expected_return REAL,
    level           INTEGER NOT NULL    -- 0 = top, 1 = category, 2 = subcategory
);

-- Append-only history snapshots
CREATE TABLE IF NOT EXISTS allocation_versions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT DEFAULT (datetime('now')),
    label       TEXT NOT NULL,          -- "Initial seed", "2026-Q2 rebalance", etc.
    snapshot    TEXT NOT NULL           -- full JSON blob for display/audit
);
```

Also add `fetched_at TEXT` column to `etf_composition`:
```sql
-- In migrate.ts (additive only):
ALTER TABLE etf_composition ADD COLUMN fetched_at TEXT;
```

- [x] **Step 2: Add migration in migrate.ts**

Add idempotent migrations for the two new tables and the `etf_composition.fetched_at` column. Pattern: wrap each `ALTER TABLE` in a try/catch that ignores `duplicate column name`.

- [x] **Step 3: Verify schema applies cleanly**

Run: `npx tsx src/lib/db/migrate.ts` (or let the app start — bootstrap calls migrate).
Expected: no errors, tables visible in SQLite.

- [x] **Step 4: Commit**

```bash
git add src/lib/db/schema.sql src/lib/db/migrate.ts
git commit -m "feat: add allocation_nodes, allocation_versions tables; add etf_composition.fetched_at"
```

---

### Task 2: Seed allocation_nodes from target_allocation.json

**Files:**
- Create: `src/lib/db/seed_allocation.ts`
- Modify: `src/lib/db/bootstrap.ts`

- [x] **Step 1: Create seed_allocation.ts**

Walk the `target_allocation.json` tree and INSERT OR IGNORE each node:

```typescript
// src/lib/db/seed_allocation.ts
import db from './client';
import targetAllocation from '../data/target_allocation.json';

interface AllocNode { weight: number; expected_return?: number; categories?: Record<string, any>; subcategories?: Record<string, any>; }

function walk(label: string, node: AllocNode, parentLabel: string | null, level: number): void {
    db.prepare(`
        INSERT OR IGNORE INTO allocation_nodes (label, parent_label, weight, expected_return, level)
        VALUES (?, ?, ?, ?, ?)
    `).run(label, parentLabel, node.weight, node.expected_return ?? null, level);

    for (const [cat, data] of Object.entries(node.categories ?? {})) walk(cat, data, label, level + 1);
    for (const [sub, data] of Object.entries(node.subcategories ?? {})) walk(sub, data, label, level + 1);
}

export function seedAllocation(): void {
    const existing = db.prepare('SELECT COUNT(*) as n FROM allocation_nodes').get() as { n: number };
    if (existing.n > 0) return; // already seeded

    const tx = db.transaction(() => {
        for (const [label, data] of Object.entries(targetAllocation)) {
            walk(label, data as AllocNode, null, 0);
        }

        // Record the initial version snapshot
        db.prepare(`
            INSERT INTO allocation_versions (label, snapshot)
            VALUES ('Initial seed', ?)
        `).run(JSON.stringify(targetAllocation));
    });
    tx();
}
```

- [x] **Step 2: Call seedAllocation from bootstrap.ts**

In `src/lib/db/bootstrap.ts`, import and call `seedAllocation()` after `seedRegistry()`.

- [x] **Step 3: Verify seeding**

Start app or run: `npx tsx -e "import('./src/lib/db/bootstrap').then(m => m.bootstrap())"`.
Check DB: `SELECT * FROM allocation_nodes ORDER BY level, parent_label` — should show 20 rows.

- [x] **Step 4: Commit**

```bash
git add src/lib/db/seed_allocation.ts src/lib/db/bootstrap.ts
git commit -m "feat: seed allocation_nodes from target_allocation.json on first run"
```

---

### Task 3: Create getAllocation() helper + update xray.ts and rebalancer.ts

**Files:**
- Create: `src/lib/db/allocation.ts`
- Modify: `src/lib/logic/xray.ts`
- Modify: `src/lib/logic/rebalancer.ts`

- [x] **Step 1: Create getAllocation() helper**

```typescript
// src/lib/db/allocation.ts
import db from './client';

export interface AllocationNode {
    label: string;
    parent_label: string | null;
    weight: number;
    expected_return: number | null;
    level: number;
}

/** Returns all allocation nodes from the DB. */
export function getAllocationNodes(): AllocationNode[] {
    return db.prepare('SELECT * FROM allocation_nodes ORDER BY level, parent_label, label').all() as AllocationNode[];
}

/**
 * Reconstructs the allocation tree in the same shape as target_allocation.json.
 * This allows a drop-in replacement for the static import.
 */
export function getAllocationTree(): Record<string, any> {
    const nodes = getAllocationNodes();
    const byLabel: Record<string, AllocationNode> = {};
    nodes.forEach(n => byLabel[n.label] = n);

    function buildNode(node: AllocationNode): any {
        const children = nodes.filter(n => n.parent_label === node.label);
        const result: any = { weight: node.weight };
        if (node.expected_return !== null) result.expected_return = node.expected_return;

        const level1 = children.filter(c => c.level === 1);
        const level2 = children.filter(c => c.level === 2);

        if (level1.length > 0) {
            result.categories = Object.fromEntries(level1.map(c => [c.label, buildNode(c)]));
        }
        if (level2.length > 0) {
            result.subcategories = Object.fromEntries(level2.map(c => [c.label, buildNode(c)]));
        }
        return result;
    }

    const roots = nodes.filter(n => n.parent_label === null);
    return Object.fromEntries(roots.map(r => [r.label, buildNode(r)]));
}
```

- [x] **Step 2: Update xray.ts to use getAllocationTree()**

Remove:
```typescript
import targetAllocation from '../data/target_allocation.json';
```
Replace with:
```typescript
import { getAllocationTree } from '../db/allocation';
```

At the top of `calculateHierarchicalMetrics`, add:
```typescript
const targetAllocation = getAllocationTree();
```

The rest of the function is unchanged — it already uses `targetAllocation` as a local variable.

- [x] **Step 3: Update rebalancer.ts similarly**

Same pattern: remove JSON import, call `getAllocationTree()` at the start of `generateDirectives`.

- [x] **Step 4: Run existing tests**

```bash
npx vitest run
```
Expected: all existing tests pass (they seed their own DB state; allocation_nodes will be empty in tests so getAllocationTree returns `{}` — verify this doesn't break test fixtures).

> If tests break because allocation_nodes is empty: add a `seedAllocation()` call in the test's `beforeEach`, or seed the nodes directly in the affected tests.

- [x] **Step 5: Commit**

```bash
git add src/lib/db/allocation.ts src/lib/logic/xray.ts src/lib/logic/rebalancer.ts
git commit -m "feat: xray and rebalancer read allocation from DB via getAllocationTree()"
```

---

### Task 4: Update /api/admin/allocation route to write DB

**Files:**
- Modify: `src/app/api/admin/allocation/route.ts`
- Modify: `src/app/admin/allocation/page.tsx`

- [x] **Step 1: Update GET to read from allocation_nodes**

Replace the JSON file read with:
```typescript
import { getAllocationTree } from '../../../../lib/db/allocation';

export async function GET() {
    const tree = getAllocationTree();
    return Response.json(tree);
}
```

- [x] **Step 2: Update PUT to write allocation_nodes and archive old version**

```typescript
export async function PUT(req: Request) {
    const newTree = await req.json();

    // Archive current allocation before overwriting
    const current = getAllocationTree();
    db.prepare(`INSERT INTO allocation_versions (label, snapshot) VALUES (?, ?)`).run(
        `Saved ${new Date().toISOString().split('T')[0]}`,
        JSON.stringify(current)
    );

    // Flatten new tree and upsert all nodes
    function walk(label: string, node: any, parentLabel: string | null, level: number): void {
        db.prepare(`
            INSERT OR REPLACE INTO allocation_nodes (label, parent_label, weight, expected_return, level)
            VALUES (?, ?, ?, ?, ?)
        `).run(label, parentLabel, node.weight, node.expected_return ?? null, level);
        for (const [cat, data] of Object.entries(node.categories ?? {})) walk(cat, data as any, label, level + 1);
        for (const [sub, data] of Object.entries(node.subcategories ?? {})) walk(sub, data as any, label, level + 1);
    }

    const tx = db.transaction(() => {
        db.prepare('DELETE FROM allocation_nodes').run(); // clear before re-seeding
        for (const [label, data] of Object.entries(newTree)) walk(label, data as any, null, 0);
    });
    tx();

    return Response.json({ ok: true });
}
```

- [x] **Step 3: Verify allocation editor still loads and saves**

Run `npm run dev`, navigate to `/admin/allocation`. Edit a weight, save. Confirm DB reflects the change and the old version appears in `allocation_versions`.

- [x] **Step 4: Commit**

```bash
git add src/app/api/admin/allocation/route.ts
git commit -m "feat: allocation API reads/writes DB instead of JSON file"
```

---

## Chunk 2: FMP Data Refresh

**Goal:** Replace Yahoo Finance fetches with FMP. Populate `etf_composition` from FMP `/v3/etf-holder` (once per fund, refresh if `fetched_at` is null or >90 days old).

### Task 5: Replace refresh.ts with FMP

**Files:**
- Modify: `src/lib/data/refresh.ts`

- [x] **Step 1: Replace price fetching with FMP**

FMP batch quotes endpoint: `https://financialmodelingprep.com/api/v3/quote/{symbol1},{symbol2},...?apikey=KEY`

Replace Yahoo `GLOBAL_QUOTE` / `chart` calls with:
```typescript
const BASE = 'https://financialmodelingprep.com/api/v3';
const FMP_KEY = process.env.FINANCIAL_MODELING_PREP_API_KEY;

async function fetchQuotesBatch(tickers: string[]): Promise<void> {
    const url = `${BASE}/quote/${tickers.join(',')}?apikey=${FMP_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
        console.warn(`FMP quotes failed: HTTP ${res.status}`);
        return;
    }
    const data = await res.json() as Array<{ symbol: string; price: number; yearHigh: number; yearLow: number }>;
    const today = new Date().toISOString().split('T')[0];
    const insert = db.prepare(`INSERT OR REPLACE INTO price_history (ticker, date, close) VALUES (?, ?, ?)`);
    const tx = db.transaction(() => data.forEach(q => insert.run(q.symbol, today, q.price)));
    tx();
}
```

- [x] **Step 2: Replace metadata fetching with FMP**

FMP profile endpoint: `https://financialmodelingprep.com/api/v3/profile/{symbol}?apikey=KEY`

Returns: `companyName`, `mktCap`, `lastDiv` (yield proxy), `isFund`, `industry`, `sector`.

For ETFs specifically, use `/v3/etf-info/{symbol}` which returns `expenseRatio`, `holdingsCount`, `nav`.

```typescript
async function fetchProfileBatch(tickers: string[]): Promise<void> {
    // FMP profile supports comma-separated symbols
    const url = `${BASE}/profile/${tickers.join(',')}?apikey=${FMP_KEY}`;
    const res = await fetch(url);
    if (!res.ok) { console.warn(`FMP profile failed: HTTP ${res.status}`); return; }
    const data = await res.json() as Array<{ symbol: string; companyName: string; lastDiv: number; beta: number }>;
    const upsert = db.prepare(`INSERT OR REPLACE INTO ticker_meta (ticker, name, yield, fetched_at) VALUES (?, ?, ?, datetime('now'))`);
    const tx = db.transaction(() => data.forEach(p => upsert.run(p.symbol, p.companyName, p.lastDiv)));
    tx();
}
```

- [x] **Step 3: Replace price history with FMP**

FMP daily history: `https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?from=2020-01-01&apikey=KEY`

Note: FMP free tier limits history requests — fetch history only for new tickers (no existing `price_history` rows), not on every refresh.

- [x] **Step 4: Add ETF expense ratio from FMP etf-info**

```typescript
async function fetchEtfMeta(ticker: string): Promise<void> {
    const url = `${BASE}/etf-info/${ticker}?apikey=${FMP_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const [data] = await res.json() as Array<{ expenseRatio: number; nav: number }>;
    if (!data) return;
    db.prepare(`UPDATE ticker_meta SET er = ? WHERE ticker = ?`).run(data.expenseRatio, ticker);
}
```

- [x] **Step 5: Commit**

```bash
git add src/lib/data/refresh.ts
git commit -m "feat: replace Yahoo Finance with FMP for prices, profiles, and ETF metadata"
```

---

### Task 6: Populate etf_composition from FMP (once per fund)

**Files:**
- Modify: `src/lib/data/refresh.ts`

**Context:** `etf_composition` currently empty — this is why concentration look-through shows nothing. FMP `/v3/etf-holder/{symbol}` returns all holdings with weights. Fetch once per ETF fund ticker, mark `fetched_at`. Re-fetch only if >90 days stale.

- [x] **Step 1: Add fetchEtfComposition function**

```typescript
async function fetchEtfComposition(fundTicker: string): Promise<void> {
    // Check if already fetched and still fresh (90 days)
    const existing = db.prepare(`
        SELECT fetched_at FROM etf_composition
        WHERE fund_ticker = ? LIMIT 1
    `).get(fundTicker) as { fetched_at: string | null } | undefined;

    if (existing?.fetched_at) {
        const age = Date.now() - new Date(existing.fetched_at).getTime();
        if (age < 90 * 24 * 60 * 60 * 1000) return; // fresh — skip
    }

    const url = `${BASE}/etf-holder/${fundTicker}?apikey=${FMP_KEY}`;
    const res = await fetch(url);
    if (!res.ok) { console.warn(`FMP etf-holder failed for ${fundTicker}: HTTP ${res.status}`); return; }
    const holdings = await res.json() as Array<{ asset: string; weightPercentage: number }>;
    if (!Array.isArray(holdings) || holdings.length === 0) return;

    const del = db.prepare('DELETE FROM etf_composition WHERE fund_ticker = ?');
    const ins = db.prepare(`
        INSERT OR REPLACE INTO etf_composition (fund_ticker, asset_ticker, weight, fetched_at)
        VALUES (?, ?, ?, datetime('now'))
    `);
    const tx = db.transaction(() => {
        del.run(fundTicker);
        holdings.forEach(h => ins.run(fundTicker, h.asset, h.weightPercentage / 100));
    });
    tx();
    console.log(`etf_composition: seeded ${holdings.length} holdings for ${fundTicker}`);
}
```

- [x] **Step 2: Call for all held ETF/FUND tickers during refresh**

In `runRefresh()`, after fetching prices, identify held fund tickers and call `fetchEtfComposition` for each:

```typescript
const heldFunds = db.prepare(`
    SELECT DISTINCT h.ticker FROM holdings h
    JOIN asset_registry ar ON h.ticker = ar.ticker
    WHERE ar.asset_type IN ('ETF', 'FUND', 'MUTUAL_FUND')
`).all() as { ticker: string }[];

for (const { ticker } of heldFunds) {
    await fetchEtfComposition(ticker);
    await sleep(500); // FMP rate limit courtesy
}
```

- [x] **Step 3: Verify etf_composition is populated**

After a refresh, run: `SELECT fund_ticker, COUNT(*) as holdings FROM etf_composition GROUP BY fund_ticker`.
Expected: rows for each held ETF (VTI → ~3500 holdings, FZROX → top holdings, etc.)

> Note: FMP free tier may only return top 10-15 holdings for some funds. That's fine — partial look-through is better than none.

- [x] **Step 4: Commit**

```bash
git add src/lib/data/refresh.ts
git commit -m "feat: populate etf_composition from FMP on refresh, cached 90 days per fund"
```

---

## Chunk 3: Allocation Explorer UI

**Goal:** Interactive slider-based simulation on `/admin/allocation`. Sliders modify a draft in DB. Before/After comparison shows impact on Expected CAGR, Tax Drag, and Expense Drag. "Accept" archives current and promotes draft.

### Task 7: Draft allocation support in DB + API

**Files:**
- Modify: `src/lib/db/allocation.ts`
- Modify: `src/app/api/admin/allocation/route.ts`

- [x] **Step 1: Add draft concept to allocation_nodes**

Add a `is_draft INTEGER DEFAULT 0` column to `allocation_nodes` (via migration). Draft rows are the "in-flight" simulation state. Active rows are `is_draft = 0`.

Alternatively: use a separate in-memory approach (React state) since drafts don't need to persist across page reloads. **Recommendation: keep draft in React state, only write to DB on Accept.** Simpler — no schema change needed.

- [x] **Step 2: Add GET /api/admin/allocation/history route**

```typescript
// src/app/api/admin/allocation/history/route.ts
export async function GET() {
    const versions = db.prepare(`
        SELECT id, created_at, label FROM allocation_versions ORDER BY created_at DESC LIMIT 20
    `).all();
    return Response.json(versions);
}
```

- [x] **Step 3: Commit**

```bash
git commit -m "feat: add allocation version history API endpoint"
```

---

### Task 8: AllocationExplorer component

**Files:**
- Modify: `src/app/admin/allocation/page.tsx`
- Create: `src/app/components/AllocationSlider.tsx`

**Context:** The current `/admin/allocation` page shows the raw JSON editor. Replace it with:
1. Slider per leaf node (level 2 subcategories) — shows current weight, allows dragging
2. Parent weights auto-sum from children (read-only display)
3. Before/After card: Expected CAGR, Expense Drag, Tax Drag delta
4. "Accept" button: saves to DB, archives old version

- [x] **Step 1: Create AllocationSlider component**

```tsx
// src/app/components/AllocationSlider.tsx
'use client';
export default function AllocationSlider({ label, weight, onChange }: {
    label: string;
    weight: number;
    onChange: (newWeight: number) => void;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className="text-[11px] text-zinc-400 w-48 truncate">{label}</div>
            <input
                type="range" min={0} max={1} step={0.01}
                value={weight}
                onChange={e => onChange(parseFloat(e.target.value))}
                className="flex-1 accent-emerald-500"
            />
            <div className="text-[12px] font-black text-zinc-200 w-10 text-right">
                {(weight * 100).toFixed(0)}%
            </div>
        </div>
    );
}
```

- [x] **Step 2: Build AllocationExplorer page**

The page fetches the current allocation tree from `/api/admin/allocation`, stores it in `draftTree` (React state), renders sliders for leaf nodes, and computes:

- **Expected CAGR** (before/after): weighted average of `expected_return` across leaf nodes × their portfolio weight
- **Expense Drag delta**: call `/api/audit` or compute inline from `expenseRisks`
- **Total weight validation**: sum of top-level nodes must equal 1.0

When user clicks Accept:
1. PUT new tree to `/api/admin/allocation`
2. Show success toast

- [x] **Step 3: Add Before/After comparison card**

```tsx
// Inside the explorer page
<div className="grid grid-cols-3 gap-4">
    {[
        { label: 'Expected CAGR', before: currentCagr, after: draftCagr, fmt: (v: number) => `${(v*100).toFixed(2)}%`, higherIsBetter: true },
        { label: 'Top-Level Weights', before: 'Stock/Bond/Cash', after: topLevelSummary, fmt: (v: string) => v, higherIsBetter: null },
    ].map(metric => (
        <div key={metric.label} className="card space-y-2">
            <div className="label-caption">{metric.label}</div>
            <div className="flex gap-4">
                <div className="text-zinc-500 text-[11px]">Now: <span className="text-zinc-200">{metric.fmt(metric.before as any)}</span></div>
                <div className="text-emerald-400 text-[11px]">New: <span className="font-black">{metric.fmt(metric.after as any)}</span></div>
            </div>
        </div>
    ))}
</div>
```

- [x] **Step 4: Verify explorer works end-to-end**

Navigate to `/admin/allocation`. Move a slider. Confirm Before/After CAGR updates. Click Accept. Confirm DB is updated and allocation_versions has a new row.

- [x] **Step 5: Commit**

```bash
git add src/app/admin/allocation/page.tsx src/app/components/AllocationSlider.tsx
git commit -m "feat: interactive allocation explorer with sliders and before/after CAGR comparison"
```
