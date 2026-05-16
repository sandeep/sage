# Spec: Allocation Explorer Slider Redesign

**Date:** 2026-03-16
**Status:** Approved for implementation

---

## Data model

The allocation tree has three tiers. All weights are **absolute portfolio weights** stored independently in `allocation_nodes` — they are NOT derived from children.

```
Stock (level 0, weight: 0.98)
  US Stock (level 1, weight: 0.68)
    US Large Cap / SP500 (level 2, weight: 0.20)  ← leaf
    Total Stock Market   (level 2, weight: 0.20)
    ...9 subcategories total
  Intl'l Stock (level 1, weight: 0.30)
    Developed Market (level 2, weight: 0.15)
    ...5 subcategories total

Bond (level 0, weight: 0.02)
  US Aggregate Bond (level 1, weight: 0.02)       ← leaf at level 1, no subcategories

Cash (level 0, weight: 0.00)                      ← leaf at level 0, no categories
```

---

## Layout

### Top-level accordion rows (Stock, Bond, Cash)

Three collapsible sections. **Stock opens on mount; Bond and Cash are collapsed.**

Each header row:
- Chevron `▼` (open) / `▶` (closed)
- Section name in 13px bold
- Slider for the top-level weight, `max={1}`, `step={0.005}`
- Numeric display of top-level weight in accent color (Stock = emerald, Bond = indigo, Cash = zinc-500)

Clicking anywhere on the header **except the slider** toggles open/closed. The slider uses `e.stopPropagation()` on click/mousedown to prevent toggling.

### Cash — leaf at level 0

Cash has no categories or subcategories. When expanded the body is empty — the header slider is the only control.

### Category header rows — level 1 with subcategories (US Stock, Intl'l Stock)

- Category name in 10px uppercase zinc
- Displays its stored `weight` value (NOT derived — it is the independently stored weight from the DB)
- No slider on the category row itself

> **Note on consistency:** The user is responsible for keeping subcategory weights summing to category weight, and category weights summing to top-level weight. The Before/After card shows validation warnings but does not auto-rebalance or block saving at any tier.

### Bond special case — level-1 leaf (US Aggregate Bond)

`US Aggregate Bond` has no subcategories. It renders inside the Bond accordion as a single row with:
- Label: "US Aggregate Bond"
- Slider: `categoryWeight={draftTree['Bond'].weight}` (passed as prop, used as `max`)
- `%` column: `bondCategoryWeight / bondTopLevelWeight * 100` using the same `weight === 0 ? '—'` rule. Since US Aggregate Bond is the only child of Bond, this always displays `100%` (or `—` when Bond weight is 0). Both values are the same node's weight, so the formula resolves to 100% as long as Bond weight > 0.
- `% Total` column: its absolute weight in emerald bold

### Subcategory rows — level 2 leaves

Each row, right of label:

| Element | Value |
|---------|-------|
| Slider | `max={topLevelWeight}` (the grandparent weight), `step={0.005}` |
| `%` | `weight === 0 ? '—' : (weight / categoryWeight * 100).toFixed(1) + '%'` |
| `% Total` | `(weight * 100).toFixed(1) + '%'` in emerald bold. Shows `0%` when weight is 0. |

Column headers `%` and `% Total` appear once per category section above the first data row in 9px uppercase zinc-600.

### Zero-weight rows

Any subcategory (or Bond's single row) where `weight === 0` renders at **32% opacity**. The slider remains interactive. The `%` column shows `—`, the `% Total` column shows `0%`. When the slider is dragged above 0 the row transitions instantly to full opacity (no CSS transition). When dragged back to 0 it returns to 32% opacity.

---

## State and update model

### Draft tree in React state

The page holds a `draftTree` in state (deep clone of the fetched allocation). Sliders call `handleSliderChange(label, newWeight)` which calls `updateLeafWeight(draftTree, label, newWeight)`.

### `updateLeafWeight` must handle level-1 leaves

The existing `updateLeafWeight` traversal only matches nodes inside `subcategories`. It must also match level-1 category nodes that are themselves leaves (no subcategories) — i.e., `US Aggregate Bond`.

**Fix:** inside `walkUpdate`, when mapping `node.categories`, mirror the existing subcategory inline label-match pattern:

```ts
// existing subcategory pattern (keep as-is):
Object.entries(node.subcategories).map(([l, d]) => [
    l,
    l === targetLabel ? { ...(d as any), weight: newWeight } : walkUpdate(d),
])

// add the same pattern for categories:
Object.entries(node.categories).map(([l, d]) => [
    l,
    l === targetLabel ? { ...(d as any), weight: newWeight } : walkUpdate(d),
])
```

### Top-level slider changes

Top-level sliders (Stock, Bond, Cash) use a **separate handler** — they do NOT go through `updateLeafWeight`. The handler updates `tree[topLabel].weight` directly in the draft tree and does not rescale category or subcategory weights:

```ts
const handleTopLevelSliderChange = (label: string, newWeight: number) => {
    setDraftTree(prev => prev ? { ...prev, [label]: { ...prev[label], weight: newWeight } } : prev);
    setSaveSuccess(false);
};
```

The Before/After card shows a warning if top-level weights do not sum to 1.0. Saving is never blocked.

### Accordion open/close state

```ts
const [openSections, setOpenSections] = useState<Record<string, boolean>>({
  Stock: true,   // open on mount
  Bond: false,
  Cash: false,
});
```

---

## `AllocationSlider` component changes

Add two props:

| Prop | Type | Purpose |
|------|------|---------|
| `categoryWeight` | `number` | Used as slider `max` and to compute the `%` column |
| `dimmed` | `boolean` | Passed from call site as `weight === 0`; applies `opacity-[0.32]` |

`dimmed` is **not internal state** — it is always computed at the call site and passed in. The component does not manage its own dimmed/active state. Because `draftTree` state updates are synchronous with `onChange`, the re-render after `slider > 0` is sufficient to restore full opacity — no `useEffect` or intermediate state is needed inside `AllocationSlider`.

---

## Validation (unchanged from current)

- Top-level sum warning in Before/After card if `|sum - 1.0| > 0.001`
- No blocking of save at any tier
- Accept Changes button stays disabled until `draftTree !== originalTree`

---

## Components affected

| File | Change |
|------|--------|
| `src/app/admin/allocation/page.tsx` | Rewrite layout to 3-tier accordion; add `openSections` state; fix `updateLeafWeight` to match level-1 leaves; add top-level slider handler |
| `src/app/components/AllocationSlider.tsx` | Add `categoryWeight: number` and `dimmed: boolean` props; render `%` and `% Total` columns; update `max` to use `categoryWeight` |

---

## What does NOT change

- `getAllocationTree()` / `PUT /api/admin/allocation` data layer
- Before/After Expected CAGR and Stock % delta panel
- Drift chart below the main grid
- Accept Changes button and save flow
- No keyboard navigation (admin tool, out of scope)
- No CSS transition on accordion open/close (instant show/hide)
