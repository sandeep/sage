# Sage UI/UX & Macro Polish Implementation Plan

**Goal:** Refine the MetricTable interaction, optimize FRED API usage, and prepare for the Allocation Exploration feature.

**Key Changes:**
1.  **MetricTable:** Add "Total Portfolio" row, implement hierarchical nesting (collapsible categories), support independent expansion, and fix "Uncategorized" visibility.
2.  **Macro Engine:** Move FRED API insights from the main dashboard to the Strategic Audit section to reduce unnecessary API calls and focus the dashboard on action.
3.  **Naming:** Standardize "Registry" as "Accounts" in the UI.
4.  **New Feature Prep:** Draft a specification for "Allocation Exploration" with interactive sliders and efficiency impact analysis.

---

## Task 1: MetricTable Refactoring

**Files:**
- Modify: `src/app/components/MetricTable.tsx`
- Modify: `src/lib/logic/xray.ts`

### 1.1: Add "Total Portfolio" to logic
 - [x] **Step 1:** Update `calculateHierarchicalMetrics` in `src/lib/logic/xray.ts` to include a "Total Portfolio" row at the very beginning.
 - [x] **Step 2:** Fix "Other / Uncategorized" row in `xray.ts`: ensure it includes `contributors` (all tickers that have unmapped value).
 - [x] **Step 3:** Ensure "Other / Uncategorized" is correctly calculated and has a unique label that the UI can reliably show.

### 1.2: Implement Hierarchical Nesting in UI
 - [x] **Step 1:** Update `MetricTable.tsx` to use a `Set<string>` for `expanded` states.
 - [x] **Step 2:** Implement visibility logic: A row is visible if its parent is expanded. (Level 0 rows are always visible).
 - [x] **Step 3:** Change click behavior:
    - Clicking a Level 0 row toggles its Level 1 children.
    - Clicking a Level 1 row toggles its Level 2 children.
    - Clicking a Level 2 (leaf) row toggles its ticker contributors.
 - [x] **Step 4:** Add a "Total Portfolio" summary row at the top of the table.

---

## Task 2: Macro/FRED Relocation

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/audit/page.tsx`

 - [x] **Step 1:** Remove `<MacroInsights />` from `src/app/page.tsx`.
 - [x] **Step 2:** Add `<MacroInsights />` to `src/app/audit/page.tsx` (Strategic Audit section).
 - [x] **Step 3:** Update dashboard layout to fill the gap left by MacroInsights (e.g., expand TaskBlotter or StrategicDiscussion).

---

## Task 3: Registry Naming Polish

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/holdings/page.tsx` (if applicable)

 - [x] **Step 1:** Change "Registry &rarr;" to "Accounts &rarr;" in the main header.
 - [x] **Step 2:** Verify other UI labels for consistency.

---

## Task 4: Allocation Exploration Specification

 - [x] **Step 1:** Create `docs/superpowers/specs/2026-03-15-allocation-exploration.md` with the following requirements:
    - Interactive sliders for target weights.
    - Three modes: **Current**, **Target**, **Future Exploration**.
    - Real-time recalculation of efficiency metrics (Tax Drag, Expense Drag) as weights change.
    - Historical tracking of target allocation changes.

---

## Verification Plan

### Automated Tests
 - [x] Run `npm run test` to ensure `calculateHierarchicalMetrics` still returns valid data.

### Manual Verification
 - [x] Open Dashboard:
    - Verify "Total Portfolio" is the first row.
    - Verify "Stock" and "Bond" are collapsible.
    - Verify clicking "Bond" shows "US Aggregate Bond".
    - Verify independent expansion works (can have Stock and Bond open at once).
    - Verify "Other / Uncategorized" is visible if it exists.
    - Verify "Registry" is now "Accounts".
 - [x] Open Audit Page:
    - Verify "Macro Insights" (FRED data) appears here.
 - [x] Verify Dashboard no longer calls `/api/macro`.
