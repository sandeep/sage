# Visual Slop Cleanup & UX Standardization Plan

**Goal:** Standardize the typographic hierarchy and layout of all major page headers and clean up the Active Ledger metadata to ensure a cohesive, professional experience across the entire dashboard.

**Core Principles:**
- **Zero Hallucination:** Only use existing Design System tokens (`ui-header`, `ui-label`, `ui-hero`).
- **Hierarchy Consistency:** VTI -> Strategy -> Actual (Left to Right).
- **Metadata Weight:** Reduce visual noise in sub-labels and breadcrumbs.

---

### Task 1: Headline Standardization
Standardize all sub-page headers to match the `PASSIVE CORE` implementation.

**Target Pages:**
1.  **Portfolio:** `src/app/passive/portfolio/page.tsx`
    - **Current:** `CORE PORTFOLIO` (Correct implementation but needs spacing check).
2.  **Strategy:** `src/app/admin/allocation/page.tsx`
    - **Issue:** Uses custom `p-16` and non-standard `text-xl`.
    - **Fix:** Switch to `page-container ui-page-spacing`. Change to `TARGET <span class="text-emerald-500">STRATEGY</span>`.
3.  **History:** `src/app/admin/snapshots/page.tsx`
    - **Issue:** Header implementation is wrapped in an extra `<section>`.
    - **Fix:** Standardize to the primary page header block. Change to `SNAPSHOT <span class="text-emerald-500">HISTORY</span>`.

**Generic Implementation Pattern:**
```tsx
<div className="flex justify-between items-end border-b border-zinc-900 pb-8">
    <div>
        <h1 className="text-ui-hero">PAGE <span className="text-emerald-500">NAME</span></h1>
        <p className="text-ui-label !text-zinc-500 mt-2 uppercase tracking-[0.3em]">Sublabel Context</p>
    </div>
</div>
```

---

### Task 2: Active Ledger Cleanup
Simplify the Trading Ledger header by removing legacy navigation and settlement basis labels.

**File:** `src/app/active/ledger/TradeLogClient.tsx`
- **Actions:**
    - Remove the `← Dashboard` link (redundant with the Sidebar).
    - Remove the `Basis: Daily Settlement` / `Basis: Transaction Ledger` span.
    - Standardize the header to match Task 1: `TRADING <span class="text-emerald-500">LEDGER</span>`.

---

### Task 3: Crisis Simulation Polish (Re-emphasize Dollars)
The user noted that the switch to `%` prominence in the last fix was a regressions in priority.

**File:** `src/app/passive/CrisisStressTableV2.tsx`
- **Action:** Restore the large dollar amount as the primary metric in the "Addl. Capital at Risk" column, keeping the % as the secondary sub-label.
- **Visual Pattern:**
    ```
    -$9k (Primary / ui-metric size)
    -3.0% (Secondary / ui-caption size)
    ```

---

### Task 4: Broader UX Review (The "Normalize" Pass)
- **Tool Selection:** I will use the `superpowers:normalize` and `superpowers:baseline-ui` skills to verify that all Tailwind utility classes match the definitions in `globals.css`.
- **Constraint:** Ensure no font sizes fall below `10px` for metadata and `13px` for body text to maintain readability on high-DPI screens.

---

### Verification Plan
1.  **Build Check:** `npm run build` to ensure no broken layout paths.
2.  **Visual Audit:** Verify all 5 major pages (Passive, Portfolio, Strategy, History, Ledger) have identical header weights and placement.
3.  **Port Verification:** All work visible on Port 3333.
