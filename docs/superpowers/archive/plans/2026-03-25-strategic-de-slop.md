# Plan: Strategic De-Slop & Design System Consolidation

## 1. Executive Summary
This plan addresses the "IA Slop" and "Design Fragmentation" across Sage. It establishes a formal Tailwind-based design system, refactors the importer into a high-signal 2-step validation gate, and hardens the rebalancer to provide specific ticker and account-level directives.

## 2. Architecture & Design System (Priority 6)

### 2.1. Tailwind Token Definition
Instead of raw classes, we will define a semantic hierarchy in `tailwind.config.ts`:
- **Fonts:** JetBrains Mono (Default).
- **IA Levels:**
  - `text-ui-header`: Massive, black, italic (The "Institutional" Title).
  - `text-ui-data`: Large, high-contrast, tabular-nums (The "Forensic" Result).
  - `text-ui-label`: Small, bold, uppercase, tracking-widest (The "Anchor").
  - `text-ui-caption`: Extra small, muted, uppercase (The "Technical Detail").

## 3. Task Breakdown

### Task 1: Importer "Validation Gate" Refactor (Priority 2)
**Goal:** Remove "Account ID" dropdown. Move "Snapshot Date" to a confirmation screen.
- [x] **Step 1:** Update `MainImporter.tsx` to a 2-state component.
- [x] **Step 2:** **State 1 (Ingest):** A simple large textarea for pasting data.
- [x] **Step 3:** **State 2 (Confirm):** After pasting, show a table summary of detected accounts and tickers. Show the `Snapshot Date` field here.
- [x] **Step 4:** **Action:** "Finalize Ledger Entry."

### Task 2: Rebalancer Forensic Upgrade (Priority 1)
**Goal:** Tickers over Categories. Accounts over Custodians.
- [x] **Step 1:** Update `rebalancer.ts` to resolve category labels to specific tickers (e.g., `Small Cap Value → AVUV`) using the `asset_registry`.
- [x] **Step 2:** Update `frictionBridge.ts` to use full account nicknames (e.g., `Fidelity Rollover IRA`) instead of generic provider labels.
- [x] **Step 3:** Verify directives: `Swap $139k FZROX → Small Cap Value (AVUV) in Fidelity Rollover IRA`.

### Task 3: Allocation Architect UX (Priority 5)
**Goal:** Add "Actual" context and "Reset" capability.
- [x] **Step 1:** Modify `AllocationSlider.tsx` to display `(Actual: XX.X%)` inline next to the target percentage.
- [x] **Step 2:** Add a "Reset to Saved" button to the `AllocationEditor` that pulls the last saved version from `allocation_versions`.

### Task 4: Dashboard Spatial Refactor & Strategy Evolution (Priority 3 & 4)
**Goal:** High-signal layout. Remove evolution "Slop."
- [x] **Step 1:** **Home Layout:** Move `TaskBlotter` (Next Best Moves) to a full-width row at the top (below chart). Move `RiskWidget` (Concentration) below it.
- [x] **Step 2:** **Evolution De-Slop:** Remove the "Regime Persistence" and "Tracking Strategic Improvement" labels.
- [x] **Step 3:** **The New View:** Replace the chart with a single, high-density **"Strategic Alpha Score"**—showing the total Sharpe improvement from your first milestone to now. If no value-add is found, we hide the section.

### Task 5: Global Design System Application
- [x] **Step 1:** Update all components to use the new semantic Tailwind tokens.
- [x] **Step 2:** Audit all `Rose/Emerald` weights for institutional consistency.

---

## 4. Final Validation
- [x] **Audit:** All pages must use the same typographic stack.
- [x] **Smoke Test:** Upload 2024 CSV → Confirm on Step 2 → Verify dot on Performance page.
