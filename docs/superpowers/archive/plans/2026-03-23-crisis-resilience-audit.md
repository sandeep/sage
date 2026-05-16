# Institutional Crisis Resilience Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Expand the historical stress-test framework to include 5 canonical crisis windows using Peak-to-Trough Maximum Drawdown math.

**Architecture:** 
1. **Engine Update:** Standardize `CRISIS_PERIODS` in `comparisonEngine.ts`.
2. **Mathematical Shift:** Implement window-based MDD using `computeMaxDrawdown` on annual Simba sequences.
3. **UI Expansion:** Refactor `CrisisStressTable.tsx` to display the expanded windows and "Resilience Alpha" logic.

**Tech Stack:** TypeScript, Simba Dataset (1972-2025).

---

### Task 1: Engine Hardening (The Pain Windows)

**Files:**
- Modify: `src/lib/logic/comparisonEngine.ts`

 - [x] **Step 1: Standardize the Crisis Windows.**
Update `CRISIS_PERIODS` to match the spec:
  - Stagflation (1973-1974)
  - Black Monday (1987)
  - Dot Com (2000-2002)
  - GFC (2008)
  - Inflation Surge (2022)
 - [x] **Step 2: Implement Peak-to-Trough logic.**
Update the loop in the API or Engine to:
  1. Slice the `annualReturns` array for the specific window.
  2. Convert to NAV via `navFromAnnualReturns`.
  3. Return `computeMaxDrawdown(nav)`.
 - [x] **Step 3: Verify math.**
Run a manual check: 2022 VTI return should be approx -19.5% (Simba nominal).

### Task 2: UI Expansion (The Resilience Ledger)

**Files:**
- Modify: `src/app/components/CrisisStressTable.tsx`

 - [x] **Step 1: Update Table Headers.**
Change "VTI" to "VTI (Market)" and add descriptive subtitles for the Macro Drivers.
 - [x] **Step 2: Implement Resilience Alpha.**
Calculate `Strategy MDD - Portfolio MDD` inline. 
Show an Emerald indicator if Strategy protected more capital.
 - [x] **Step 3: Polish Narrative.**
Update the verdict text to use the Resilience Alpha metric.
 - [x] **Step 4: Verify Typography.**
Ensure all numbers use `tabular-nums` and a minimum of `text-sm`.

### Task 3: API & Final Validation

**Files:**
- Modify: `src/app/api/performance/comparison/route.ts`

 - [x] **Step 1: Integrate new crisis data.**
Ensure the API correctly passes the MDD-based `crisisData` to the frontend.
 - [x] **Step 2: Check for regressions.**
Verify that the 50Y Growth Chart still functions correctly.
 - [x] **Step 3: Final LOC Audit.**
Ensure `comparisonEngine.ts` stays under 250 lines and is well-componentized.
 - [x] **Step 4: Commit.**
```bash
git commit -m "feat: implement institutional crisis resilience audit (the pain audit)"
```
