# Metric Table Redesign Spec

**Date:** 2026-03-17

## Problems

1. **Unstable category order.** Top-level sections (Stock, Bond, Cash) come from `Object.entries(targetAllocation)` which relies on JSON key insertion order. Adding/editing the allocation JSON can silently reorder them. "Other / Uncategorized" is computed and appended last, but there's no guarantee on the rest.

2. **Ticker hover card appears on wrong rows / gets clipped.** Two bugs:
   - CSS `position: relative` on a `<tr>` element does not create a containing block in most browsers. The `absolute` tooltip is positioned relative to some ancestor far up the tree, not the row — making placement unreliable.
   - The MetricTable wrapper in `page.tsx` has `overflow-hidden` and the inner div has `overflow-x-auto`. Both clip any absolutely-positioned child that extends beyond the table bounds. The hover card on the last row is hidden because it extends below the clipped boundary.

3. **Hover card is not scoped to ticker rows.** Visually the card should only appear on the leaf-level contributor (ticker) rows, but the current `group`/`group-hover` CSS pattern can be triggered unexpectedly. The spec should lock this down explicitly.

---

## Design

### 1. Fixed category order and display names

In `src/lib/logic/xray.ts`, replace `Object.entries(targetAllocation).forEach(...)` with an explicit ordered iteration:

```typescript
const CATEGORY_ORDER = ['Stock', 'Bond', 'Cash'];

CATEGORY_ORDER.forEach(label => {
    if (targetAllocation[label]) processNode(label, targetAllocation[label], 0, ...);
});
// Then append any keys not in the canonical list (forward-compat)
Object.keys(targetAllocation)
    .filter(k => !CATEGORY_ORDER.includes(k))
    .forEach(label => processNode(label, targetAllocation[label], 0, ...));
// "Other / Uncategorized" is appended last as today
```

In `src/app/components/MetricTable.tsx`, add a display name map so the table always reads cleanly:

```typescript
const DISPLAY_NAMES: Record<string, string> = {
    'Stock':                'Stocks',
    'Bond':                 'Bonds',
    'Cash':                 'Cash',
    'Other / Uncategorized':'Other',
};
// Usage: DISPLAY_NAMES[m.label] ?? m.label
```

### 2. Ticker hover card — fixed positioning via React state

Remove the CSS-only `group` / `group-hover:block absolute` pattern entirely. Replace with React state that tracks which contributor is hovered, and renders a single `fixed`-positioned overlay.

**State in MetricTable:**
```typescript
const [hoveredContributor, setHoveredContributor] = useState<{
    contributor: ContributorType;
    rect: DOMRect;
} | null>(null);
```

**On contributor row:**
```tsx
<tr
    onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredContributor({ contributor: c, rect });
    }}
    onMouseLeave={() => setHoveredContributor(null)}
>
```

**Overlay rendered at root of MetricTable (outside table DOM):**
```tsx
{hoveredContributor && (
    <TickerHoverCard
        contributor={hoveredContributor.contributor}
        anchorRect={hoveredContributor.rect}
    />
)}
```

**`TickerHoverCard` uses `position: fixed` with smart vertical placement:**
```tsx
function TickerHoverCard({ contributor: c, anchorRect }: { contributor: ..., anchorRect: DOMRect }) {
    const CARD_HEIGHT = 220; // approximate
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const top = spaceBelow >= CARD_HEIGHT
        ? anchorRect.top              // show below row
        : anchorRect.bottom - CARD_HEIGHT; // flip up
    const left = Math.min(anchorRect.right + 8, window.innerWidth - 320 - 8);

    return (
        <div
            className="fixed z-[100] w-80 bg-zinc-900 border border-zinc-700 shadow-2xl rounded-sm p-4 pointer-events-none font-mono text-left"
            style={{ top, left }}
        >
            {/* card contents unchanged */}
        </div>
    );
}
```

This removes all dependency on `overflow` containment and `<tr>` as a containing block.

### 3. Remove `overflow-hidden` from MetricTable wrapper in page.tsx

Change:
```tsx
<div className="border border-zinc-900 rounded-sm overflow-hidden bg-zinc-950/50">
```
To:
```tsx
<div className="border border-zinc-900 rounded-sm bg-zinc-950/50">
```

The `overflow-hidden` was only needed to clip rounded corners on the inner table header. With the hover card now using `fixed` positioning it's no longer clipping anything, but we should still remove it to avoid future issues.

---

## Files

| File | Change |
|---|---|
| `src/lib/logic/xray.ts` | Add `CATEGORY_ORDER` constant; replace `Object.entries` loop |
| `src/app/components/MetricTable.tsx` | Add `DISPLAY_NAMES` map; replace `group-hover` tooltip with state + `TickerHoverCard` |
| `src/app/page.tsx` | Remove `overflow-hidden` from MetricTable wrapper div |

---

## Out of scope

- Reordering subcategories within a top-level section (that order comes from the allocation JSON and is intentional)
- Adding new top-level categories (handled by the forward-compat fallback in the ordered iteration)
