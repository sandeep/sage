# Institutional Alpha Leakage Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Refactor the Audit page into a stable, professional institutional terminal by unifying math, types, and visuals into a cohesive "Strategic Verdict" narrative.

**Architecture:** 
1. **Foundation:** Centralize types and date anchors to prevent casing and drift errors.
2. **Logic Consolidation:** Unify all performance math into a single, testable `auditEngine.ts`.
3. **Institutional UI:** Implement the Frontier Plot, Performance Waterfall, and Strategic Variance Ledger components.

**Tech Stack:** Next.js, TypeScript (Strict), Recharts, better-sqlite3, Vitest.

---

### Task 1: Foundation (Shared Types & Date Anchors)

**Files:**
- Create: `src/lib/types/audit.ts`
- Modify: `src/lib/logic/referenceDates.ts`
- Test: `src/lib/types/__tests__/audit_schema.test.ts`

 - [x] **Step 1: Define shared institutional types.**
  Ensure `TaxEfficiencyTier` and `LeakageRow` are codified to prevent casing mismatches.
 - [x] **Step 2: Anchor the system date.**
  Verify `referenceDates.ts` exports `TODAY_ANCHOR = '2026-03-20'`.
 - [x] **Step 3: Run Type Check.**
  Run: `npx tsc --noEmit src/lib/types/audit.ts`
  Expected: PASS.
 - [x] **Step 4: Commit foundation.**

### Task 2: Build Error & Crash Resolution

**Files:**
- Modify: `src/lib/logic/auditEngine.ts`
- Modify: `src/lib/logic/xray.ts`
- Modify: `src/lib/logic/efficiency.ts`
- Modify: `src/lib/logic/xray_risks.ts`

 - [x] **Step 1: Fix casing mismatches in efficiency engines.**
  Standardize all `very_inefficient` and `inefficient` checks to use the new shared types.
 - [x] **Step 2: Resolve orphaned references.**
  Ensure `resolveValue` is correctly exported from `xray.ts` and imported by `xray_risks.ts`.
 - [x] **Step 3: Verify math determinism.**
  Ensure all DB queries in `auditEngine.ts` use `TODAY_ANCHOR`.
 - [x] **Step 4: Run production build check.**
  Run: `npm run build`
  Expected: PASS (no TS or build errors).
 - [x] **Step 5: Commit stability fixes.**

### Task 3: Visual Proof (PerformanceFrontier)

**Files:**
- Create: `src/app/components/PerformanceFrontier.tsx`
- Modify: `src/app/audit/page.tsx`
- Modify: `src/lib/logic/auditEngine.ts`

 - [x] **Step 1: Update AuditReport schema.**
  Add `coordinates: { vti: Point, target: Point, actual: Point }` to the engine output.
 - [x] **Step 2: Implement PerformanceFrontier component.**
  Build the Return vs Vol scatter plot using Recharts.
 - [x] **Step 3: Inject Frontier into the Hero slot.**
  Update `AuditPage.tsx` to lead with the visual proof.
 - [x] **Step 4: Verify rendering.**
  Confirm the "Actual" dot sits below the "Target" curve.
 - [x] **Step 5: Commit Phase 1 UI.**

### Task 4: Narrative Bridge (PerformanceWaterfall)

**Files:**
- Create: `src/app/components/PerformanceWaterfall.tsx`
- Modify: `src/lib/logic/auditEngine.ts`

 - [x] **Step 1: Implement Waterfall calculation.**
  Calculate the bridge: Target (18.0%) -> Fees -> Cash -> Drift -> Actual (13.3%).
 - [x] **Step 2: Build PerformanceWaterfall component.**
  Create the "Erosion Pipe" visual between Strategy and Realized Return.
 - [x] **Step 3: Update AuditPage layout.**
  Place the Waterfall bridge between the Hero and the Ledger.
 - [x] **Step 4: Commit Phase 2 UI.**

### Task 5: Institutional Invoice (StrategicVarianceLedger)

**Files:**
- Create: `src/app/components/StrategicVarianceLedger.tsx`
- Modify: `src/app/audit/page.tsx`
- Remove: `src/app/components/AllocationGapProof.tsx`

 - [x] **Step 1: Implement the requested 'Leakage Ledger'.**
  Columns: `Source of Leakage`, `Under/Over Target Δ`, `Market Return`, `Dollar Impact`.
  Categories: Large Cap, International, SCV/REITs, Cash.
 - [x] **Step 2: Stylize with heavy institutional borders.**
  Use monospace fonts and high-contrast grid lines.
 - [x] **Step 3: Implement the $87,530 reconciliation footer.**
  Ensure the sum matches the headline loss.
 - [x] **Step 4: Verify labels.**
  Ensure "Under/Over Target Δ" is clearly displayed.
 - [x] **Step 5: Commit Phase 3 UI.**

### Task 6: Final Resilience Audit & Cleanup

**Files:**
- Modify: `src/app/components/CrisisStressTable.tsx`
- Modify: `src/app/audit/page.tsx`

 - [x] **Step 1: Add 'Actual (Simulated)' to Crisis Stress Test.**
  Show how the current drift would have died in 2008 and 2000.
 - [x] **Step 2: Final Typography Pass.**
  Search and destroy all remaining `text-[9px]` or `text-[10px]` tags.
 - [x] **Step 3: Removal of Debug Scripts.**
  Ensure all `debug_*.ts` and `audit_*.ts` files are gone.
 - [x] **Step 4: Final Production Validation.**
  Run: `npm run build && npm run lint`
  Expected: PASS with ZERO errors.
 - [x] **Step 5: Final Commit.**
