# Allocation Explorer Slider Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Replace the flat slider list in `/admin/allocation` with a 3-tier accordion (Stock / Bond / Cash) that shows per-subcategory `%` (of section) and `% Total` (absolute portfolio) columns, with zero-weight rows dimmed.

**Architecture:** Two files change. `AllocationSlider` gains `categoryWeight` and `dimmed` props to render the dual-metric columns. The page is rewritten with accordion state, a fixed `updateLeafWeight` that handles level-1 leaves, and a separate top-level slider handler. The data layer, Before/After panel, and drift chart are untouched.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS. Tests via Vitest.

**Spec:** `docs/superpowers/specs/2026-03-16-allocation-slider-redesign.md`

---

## File Map

| File | Status | Change |
|------|--------|--------|
| `src/app/components/AllocationSlider.tsx` | Modify | Add `categoryWeight`, `dimmed` props; render `%` + `% Total` columns |
| `src/app/admin/allocation/page.tsx` | Rewrite | 3-tier accordion, `openSections` state, `updateLeafWeight` fix, top-level handler |
| `src/lib/logic/__tests__/allocation_helpers.test.ts` | Create | Unit tests for `updateLeafWeight` and `computeTopLevelSum` |

---

## Chunk 1: AllocationSlider component

### Task 1: Update AllocationSlider with dual-metric columns

**Files:**
- Modify: `src/app/components/AllocationSlider.tsx`

The current component renders: `[label][slider][weight%][E[r]]`

New layout renders: `[label][slider][% of section][% Total]`

- `categoryWeight` is used as the slider `max` and to compute the `%` (of section) column.
- `dimmed` is passed from the call site as `weight === 0`; applies `opacity-[0.32]` to the whole row.
- The `%` column shows `—` when `weight === 0`, otherwise `(weight / categoryWeight * 100).toFixed(1) + '%'`.
- The `% Total` column shows `(weight * 100).toFixed(1) + '%'` always (shows `0%` when weight is 0), in emerald bold.
- Remove the `expectedReturn` display — the new column layout replaces it. Keep the prop optional for backwards compatibility but stop rendering it.

 - [x] **Step 1: Rewrite AllocationSlider**

Replace the entire file with:

```tsx
'use client';
import React from 'react';

export default function AllocationSlider({
    label,
    weight,
    categoryWeight,
    dimmed = false,
    onChange,
}: {
    label: string;
    weight: number;
    categoryWeight: number;
    dimmed?: boolean;
    expectedReturn?: number | null; // kept for compat, no longer rendered
    onChange: (newWeight: number) => void;
}) {
    const pctOfSection = weight === 0
        ? '—'
        : categoryWeight > 0
            ? `${(weight / categoryWeight * 100).toFixed(1)}%`
            : '—';
    const pctTotal = `${(weight * 100).toFixed(1)}%`;

    return (
        <div
            className="flex items-center gap-3 py-1.5 group"
            style={{ opacity: dimmed ? 0.32 : 1 }}
        >
            <div className="text-[11px] text-zinc-400 flex-1 truncate group-hover:text-zinc-200 transition-colors" title={label}>
                {label}
            </div>
            <input
                type="range"
                min={0}
                max={categoryWeight}
                step={0.005}
                value={weight}
                onChange={e => onChange(parseFloat(e.target.value))}
                className="w-20 h-1 accent-emerald-500 cursor-pointer"
            />
            <span className="text-[10px] text-zinc-500 tabular-nums w-12 text-right">
                {pctOfSection}
            </span>
            <span className="text-[12px] font-black text-emerald-400 tabular-nums w-10 text-right">
                {pctTotal}
            </span>
        </div>
    );
}
```

 - [x] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors in `AllocationSlider.tsx`. (Errors may appear in `page.tsx` because it passes the old prop shape — those are fixed in Task 3.)

 - [x] **Step 3: Commit**

```bash
git add src/app/components/AllocationSlider.tsx
git commit -m "feat: add categoryWeight + dimmed props to AllocationSlider; dual % columns"
```

---

## Chunk 2: Page logic and accordion layout

### Task 2: Fix `updateLeafWeight` and add unit tests

**Files:**
- Modify: `src/app/admin/allocation/page.tsx` (lines 37–68, `updateLeafWeight` only)
- Create: `src/lib/logic/__tests__/allocation_helpers.test.ts`

The current `updateLeafWeight` only matches labels inside `subcategories`. It misses level-1 category nodes that are themselves leaves (e.g. `US Aggregate Bond` lives in `node.categories` but has no `subcategories`). Fix: add the same inline label-match to the categories map.

 - [x] **Step 1: Write failing test**

Create `src/lib/logic/__tests__/allocation_helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

// Copy of the function under test — paste verbatim from page.tsx after the fix
function updateLeafWeight(
    tree: Record<string, any>,
    targetLabel: string,
    newWeight: number
): Record<string, any> {
    function walkUpdate(node: any): any {
        const updatedCats = node.categories
            ? Object.fromEntries(
                Object.entries(node.categories).map(([l, d]) => [
                    l,
                    l === targetLabel ? { ...(d as any), weight: newWeight } : walkUpdate(d),
                ])
              )
            : undefined;
        const updatedSubs = node.subcategories
            ? Object.fromEntries(
                Object.entries(node.subcategories).map(([l, d]) => [
                    l,
                    l === targetLabel ? { ...(d as any), weight: newWeight } : walkUpdate(d),
                ])
              )
            : undefined;
        return {
            ...node,
            ...(updatedCats ? { categories: updatedCats } : {}),
            ...(updatedSubs ? { subcategories: updatedSubs } : {}),
        };
    }
    return Object.fromEntries(
        Object.entries(tree).map(([l, d]) => [
            l,
            l === targetLabel ? { ...(d as any), weight: newWeight } : walkUpdate(d),
        ])
    );
}

function computeTopLevelSum(tree: Record<string, any>): number {
    return Object.values(tree).reduce((sum: number, node: any) => sum + (node.weight ?? 0), 0);
}

const MINI_TREE = {
    Stock: {
        weight: 0.98,
        categories: {
            'US Stock': {
                weight: 0.68,
                subcategories: {
                    'US Large Cap': { weight: 0.20 },
                    'Small Cap Value': { weight: 0.10 },
                },
            },
        },
    },
    Bond: {
        weight: 0.02,
        categories: {
            'US Aggregate Bond': { weight: 0.02 }, // level-1 leaf — no subcategories
        },
    },
    Cash: { weight: 0.00 },
};

describe('updateLeafWeight', () => {
    it('updates a level-2 subcategory weight', () => {
        const result = updateLeafWeight(MINI_TREE, 'US Large Cap', 0.25);
        expect(result.Stock.categories['US Stock'].subcategories['US Large Cap'].weight).toBe(0.25);
        // other nodes unchanged
        expect(result.Stock.categories['US Stock'].subcategories['Small Cap Value'].weight).toBe(0.10);
    });

    it('updates a level-1 leaf category weight (Bond special case)', () => {
        const result = updateLeafWeight(MINI_TREE, 'US Aggregate Bond', 0.05);
        expect(result.Bond.categories['US Aggregate Bond'].weight).toBe(0.05);
        // sibling nodes unchanged
        expect(result.Stock.weight).toBe(0.98);
    });

    it('does not mutate the original tree', () => {
        const original = MINI_TREE.Bond.categories['US Aggregate Bond'].weight;
        updateLeafWeight(MINI_TREE, 'US Aggregate Bond', 0.10);
        expect(MINI_TREE.Bond.categories['US Aggregate Bond'].weight).toBe(original);
    });
});

describe('computeTopLevelSum', () => {
    it('sums top-level weights correctly', () => {
        expect(computeTopLevelSum(MINI_TREE)).toBeCloseTo(1.00);
    });

    it('detects invalid sum', () => {
        const bad = { ...MINI_TREE, Bond: { ...MINI_TREE.Bond, weight: 0.10 } };
        expect(computeTopLevelSum(bad)).toBeGreaterThan(1.0);
    });
});
```

 - [x] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/lib/logic/__tests__/allocation_helpers.test.ts
```

Expected: `updateLeafWeight > updates a level-1 leaf category weight` FAILS because the current function doesn't match category-level labels.

 - [x] **Step 3: Fix `updateLeafWeight` in `page.tsx`**

In `src/app/admin/allocation/page.tsx`, replace the categories map inside `walkUpdate` (lines 43–47):

```ts
// BEFORE:
const updatedCats = node.categories
    ? Object.fromEntries(
        Object.entries(node.categories).map(([l, d]) => [l, walkUpdate(d)])
      )
    : undefined;

// AFTER — mirror the subcategory inline label-match:
const updatedCats = node.categories
    ? Object.fromEntries(
        Object.entries(node.categories).map(([l, d]) => [
            l,
            l === targetLabel ? { ...(d as any), weight: newWeight } : walkUpdate(d),
        ])
      )
    : undefined;
```

Then update the test file to import `updateLeafWeight` and `computeTopLevelSum` directly from `page.tsx` instead of copying the functions. Since `page.tsx` is a client component and not easily importable in tests, keep the functions as copies in the test — but paste the fixed version.

 - [x] **Step 4: Run tests — expect all pass**

```bash
npx vitest run src/lib/logic/__tests__/allocation_helpers.test.ts
```

Expected: all 5 tests pass.

 - [x] **Step 5: Commit**

```bash
git add src/app/admin/allocation/page.tsx src/lib/logic/__tests__/allocation_helpers.test.ts
git commit -m "fix: updateLeafWeight matches level-1 leaf categories (Bond); add unit tests"
```

---

### Task 3: Rewrite page layout as 3-tier accordion

**Files:**
- Modify: `src/app/admin/allocation/page.tsx`

This is a full rewrite of the JSX render section and state. The helper functions (`computeExpectedCagr`, `computeStockWeight`, `computeTopLevelSum`, `updateLeafWeight`) are kept. The `extractLeafNodes` function and `LeafNode` type are **removed** — they are replaced by the accordion rendering logic which traverses the tree directly.

New state added:
```ts
const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Stock: true, Bond: false, Cash: false,
});
```

New handler added (top-level sliders only):
```ts
const handleTopLevelSliderChange = useCallback((label: string, newWeight: number) => {
    setDraftTree(prev => prev ? { ...prev, [label]: { ...prev[label], weight: newWeight } } : prev);
    setSaveSuccess(false);
}, []);
```

 - [x] **Step 1: Rewrite `page.tsx` render section**

Replace everything from `// ── types` through the end of the `return` statement with the following. Keep all helper functions above it unchanged (except the `updateLeafWeight` fix already applied in Task 2).

```tsx
// ── accordion accent colours ──────────────────────────────────────────────────

const ACCENT: Record<string, string> = {
    Stock: 'text-emerald-400',
    Bond:  'text-indigo-400',
    Cash:  'text-zinc-500',
};

// ── main component ────────────────────────────────────────────────────────────

export default function AllocationExplorer() {
    const [originalTree, setOriginalTree] = useState<Record<string, any> | null>(null);
    const [draftTree, setDraftTree]       = useState<Record<string, any> | null>(null);
    const [saving, setSaving]             = useState(false);
    const [saveError, setSaveError]       = useState('');
    const [saveSuccess, setSaveSuccess]   = useState(false);
    const [history, setHistory]           = useState<HistoryPoint[]>([]);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        Stock: true, Bond: false, Cash: false,
    });

    useEffect(() => {
        fetch('/api/admin/allocation')
            .then(r => r.json())
            .then((tree: Record<string, any>) => {
                setOriginalTree(tree);
                setDraftTree(structuredClone(tree));
            });
        fetch('/api/admin/allocation/history')
            .then(r => r.json())
            .then(setHistory);
    }, []);

    const handleSliderChange = useCallback((label: string, newWeight: number) => {
        setDraftTree(prev => prev ? updateLeafWeight(prev, label, newWeight) : prev);
        setSaveSuccess(false);
    }, []);

    const handleTopLevelSliderChange = useCallback((label: string, newWeight: number) => {
        setDraftTree(prev => prev ? { ...prev, [label]: { ...(prev[label] as any), weight: newWeight } } : prev);
        setSaveSuccess(false);
    }, []);

    const hasChanges = useCallback((): boolean => {
        if (!originalTree || !draftTree) return false;
        return JSON.stringify(originalTree) !== JSON.stringify(draftTree);
    }, [originalTree, draftTree]);

    const handleAccept = async () => {
        if (!draftTree) return;
        setSaving(true); setSaveError(''); setSaveSuccess(false);
        const res = await fetch('/api/admin/allocation', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draftTree),
        });
        const json = await res.json();
        if (!res.ok) {
            setSaveError(json.error ?? 'Save failed');
        } else {
            setOriginalTree(structuredClone(draftTree));
            setSaveSuccess(true);
        }
        setSaving(false);
    };

    if (!draftTree || !originalTree) {
        return <div className="text-zinc-500 p-8 font-mono text-[11px]">Loading...</div>;
    }

    const origCagr    = computeExpectedCagr(originalTree);
    const draftCagr   = computeExpectedCagr(draftTree);
    const origStock   = computeStockWeight(originalTree);
    const draftStock  = computeStockWeight(draftTree);
    const topLevelSum = computeTopLevelSum(draftTree);
    const sumOk       = Math.abs(topLevelSum - 1) < 0.001;
    const changed     = hasChanges();

    // ── render helpers ──────────────────────────────────────────────────────

    function renderSubcategorySection(
        catLabel: string,
        catNode: any,
        topLevelWeight: number
    ) {
        const subs: [string, any][] = Object.entries(catNode.subcategories ?? {});
        if (subs.length === 0) return null;
        return (
            <div key={catLabel} className="border-t border-zinc-900">
                {/* Category header row */}
                <div className="flex justify-between items-center px-4 py-2 pl-7">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{catLabel}</span>
                    <span className="text-[11px] font-bold text-zinc-400 tabular-nums">
                        {(catNode.weight * 100).toFixed(1)}%
                    </span>
                </div>
                {/* Column headers */}
                <div className="flex justify-end items-center gap-3 px-4 pb-1 pl-8 border-b border-zinc-900/60">
                    <div className="flex-1" />
                    <div className="w-20" />
                    <span className="text-[9px] uppercase tracking-widest text-zinc-700 w-12 text-right">%</span>
                    <span className="text-[9px] uppercase tracking-widest text-zinc-700 w-10 text-right">% Total</span>
                </div>
                {/* Subcategory rows */}
                <div className="px-4 pb-3 pl-8">
                    {subs.map(([subLabel, subNode]) => (
                        <AllocationSlider
                            key={subLabel}
                            label={subLabel}
                            weight={subNode.weight}
                            categoryWeight={catNode.weight}
                            dimmed={subNode.weight === 0}
                            onChange={w => handleSliderChange(subLabel, w)}
                        />
                    ))}
                </div>
            </div>
        );
    }

    function renderBondLeafSection(catLabel: string, catNode: any, bondTopWeight: number) {
        // Bond's US Aggregate Bond has no subcategories — render as a single leaf row
        return (
            <div key={catLabel} className="border-t border-zinc-900">
                <div className="flex justify-end items-center gap-3 px-4 pb-1 pt-2 border-b border-zinc-900/60">
                    <div className="flex-1" />
                    <div className="w-20" />
                    <span className="text-[9px] uppercase tracking-widest text-zinc-700 w-12 text-right">%</span>
                    <span className="text-[9px] uppercase tracking-widest text-zinc-700 w-10 text-right">% Total</span>
                </div>
                <div className="px-4 pb-3">
                    <AllocationSlider
                        label={catLabel}
                        weight={catNode.weight}
                        categoryWeight={bondTopWeight}
                        dimmed={catNode.weight === 0}
                        onChange={w => handleSliderChange(catLabel, w)}
                    />
                </div>
            </div>
        );
    }

    function renderTopSection(topLabel: string, topNode: any) {
        const isOpen = openSections[topLabel] ?? false;
        const accentClass = ACCENT[topLabel] ?? 'text-zinc-400';
        const cats: [string, any][] = Object.entries(topNode.categories ?? {});

        return (
            <div key={topLabel} className="border border-zinc-800 rounded-md overflow-hidden mb-2">
                {/* Accordion header */}
                <div
                    className="flex justify-between items-center px-4 py-3 bg-zinc-900 cursor-pointer select-none"
                    onClick={() => setOpenSections(prev => ({ ...prev, [topLabel]: !prev[topLabel] }))}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-600 text-[10px]">{isOpen ? '▼' : '▶'}</span>
                        <span className="text-[13px] font-black text-zinc-100">{topLabel}</span>
                    </div>
                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                        <input
                            type="range"
                            min={0} max={1} step={0.005}
                            value={topNode.weight}
                            onChange={e => handleTopLevelSliderChange(topLabel, parseFloat(e.target.value))}
                            className="w-24 h-1 accent-emerald-500 cursor-pointer"
                            onMouseDown={e => e.stopPropagation()}
                        />
                        <span className={`text-[14px] font-black tabular-nums w-12 text-right ${accentClass}`}>
                            {(topNode.weight * 100).toFixed(1)}%
                        </span>
                    </div>
                </div>

                {/* Body — only rendered when open */}
                {isOpen && (
                    <div>
                        {cats.map(([catLabel, catNode]) =>
                            catNode.subcategories
                                ? renderSubcategorySection(catLabel, catNode, topNode.weight)
                                : renderBondLeafSection(catLabel, catNode, topNode.weight)
                        )}
                        {/* Cash has no categories — body is empty */}
                    </div>
                )}
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-black text-white font-mono">
            <div className="page-container space-y-8">
                {/* Header */}
                <header className="flex justify-between items-end border-b border-zinc-900 pb-8">
                    <div className="space-y-2">
                        <Link href="/" className="back-link">← Dashboard</Link>
                        <h1 className="page-title" style={{ fontSize: '1.875rem' }}>Allocation Explorer</h1>
                        <p className="text-[11px] text-zinc-600">Adjust weights with sliders. Top-level must sum to 100%.</p>
                    </div>
                    <button
                        onClick={handleAccept}
                        disabled={!changed || saving}
                        className="px-4 py-2 text-[12px] font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving...' : 'Accept Changes'}
                    </button>
                </header>

                {saveError && (
                    <div className="text-rose-500 text-[11px] font-black px-4 py-2 border border-rose-900 rounded-sm">
                        {saveError}
                    </div>
                )}
                {saveSuccess && (
                    <div className="text-emerald-500 text-[11px] font-black px-4 py-2 border border-emerald-900 rounded-sm">
                        Allocation saved.
                    </div>
                )}

                {/* Two-column layout: accordions left, before/after right */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left: accordions */}
                    <div className="lg:col-span-2">
                        {Object.entries(draftTree).map(([topLabel, topNode]) =>
                            renderTopSection(topLabel, topNode as any)
                        )}
                    </div>

                    {/* Right: Before / After */}
                    <div className="space-y-4">
                        <div className="card space-y-5">
                            <div className="label-caption mb-1">Before / After</div>

                            <div className="space-y-1">
                                <div className="text-[10px] text-zinc-600 uppercase tracking-widest">Expected CAGR</div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-[13px] font-black text-zinc-400 tabular-nums">{(origCagr * 100).toFixed(1)}%</span>
                                    <span className="text-zinc-700 text-[11px]">→</span>
                                    <span className="text-[13px] font-black text-zinc-200 tabular-nums">{(draftCagr * 100).toFixed(1)}%</span>
                                    <Delta before={origCagr} after={draftCagr} />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="text-[10px] text-zinc-600 uppercase tracking-widest">Stock Allocation</div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-[13px] font-black text-zinc-400 tabular-nums">{(origStock * 100).toFixed(0)}%</span>
                                    <span className="text-zinc-700 text-[11px]">→</span>
                                    <span className="text-[13px] font-black text-zinc-200 tabular-nums">{(draftStock * 100).toFixed(0)}%</span>
                                    <Delta before={origStock} after={draftStock} />
                                </div>
                            </div>

                            <div className="border-t border-zinc-900 pt-4 space-y-1">
                                <div className="text-[10px] text-zinc-600 uppercase tracking-widest">Top-level sum</div>
                                <div className={`text-[13px] font-black tabular-nums ${sumOk ? 'text-emerald-400' : 'text-amber-500'}`}>
                                    {(topLevelSum * 100).toFixed(1)}%
                                    {!sumOk && <span className="text-[10px] font-bold ml-2">⚠ must equal 100%</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Allocation Drift over Time */}
                {history.length > 1 && (
                    <div className="card space-y-4">
                        <div className="label-caption">Allocation Drift over Time</div>
                        <p className="text-[11px] text-zinc-600">Target Expected CAGR and stock weight across saved versions.</p>
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={history} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                                <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="cagr" tickFormatter={v => `${(v * 100).toFixed(1)}%`} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={44} />
                                <YAxis yAxisId="stock" orientation="right" tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={36} />
                                <Tooltip contentStyle={{ background: '#09090b', border: '1px solid #27272a', fontSize: 11, fontFamily: 'monospace' }} labelStyle={{ color: '#a1a1aa' }} formatter={(val: any) => [`${(Number(val) * 100).toFixed(1)}%`]} />
                                <Legend formatter={name => name === 'expectedCagr' ? 'E[CAGR]' : 'Stock %'} wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', color: '#71717a' }} />
                                <Line yAxisId="cagr" type="monotone" dataKey="expectedCagr" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                                <Line yAxisId="stock" type="monotone" dataKey="stockWeight" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                        <div className="space-y-1 border-t border-zinc-900 pt-3">
                            {history.map(h => (
                                <div key={h.id} className="flex gap-3 text-[11px] text-zinc-500">
                                    <span className="text-zinc-700 tabular-nums w-24">{h.date}</span>
                                    <span className="text-emerald-600 tabular-nums w-14">{(h.expectedCagr * 100).toFixed(1)}%</span>
                                    <span className="text-indigo-400 tabular-nums w-12">{(h.stockWeight * 100).toFixed(0)}% eq</span>
                                    <span className="text-zinc-600 truncate">{h.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
```

 - [x] **Step 2: Add the `Delta` component back** (it was in the old file — ensure it is still present above the main component)

The `Delta` component must remain in the file:

```tsx
function Delta({ before, after, suffix = '%', scale = 100 }: {
    before: number; after: number; suffix?: string; scale?: number;
}) {
    const delta = (after - before) * scale;
    const color = delta > 0.05 ? 'text-emerald-400' : delta < -0.05 ? 'text-red-400' : 'text-zinc-500';
    return (
        <span className={`text-[11px] font-black tabular-nums ${color}`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}{suffix}
        </span>
    );
}
```

 - [x] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

 - [x] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass including the new `allocation_helpers` suite.

 - [x] **Step 5: Smoke test in browser**

Start dev server: `npm run dev`

Navigate to `http://localhost:3000/admin/allocation`.

Verify:
- Stock section is open; Bond and Cash are collapsed
- Clicking Bond header expands it, shows US Aggregate Bond row
- Subcategory sliders respond; `%` and `% Total` update live
- Zero-weight rows (Mid-Cap, Energy, etc.) are visibly dimmed
- Dragging a zero-weight slider above 0 restores full opacity instantly
- Accept Changes button enables after any change
- Before/After card shows CAGR and Stock % delta

 - [x] **Step 6: Commit**

```bash
git add src/app/admin/allocation/page.tsx
git commit -m "feat: 3-tier accordion layout for allocation explorer"
```
