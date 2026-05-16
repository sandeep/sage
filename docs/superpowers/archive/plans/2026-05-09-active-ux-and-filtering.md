# Issue: Active Performance UX & Filtering Logic

## Status
- **Priority:** High
- **Category:** UX / Functional Consistency
- **Target Pages:** 
  - `src/app/active/page.tsx` (Active Performance)
  - `src/app/active/ledger/TradeLogClient.tsx` (Trading Ledger)

## Problem Statement
The Active Performance view lacks the typographic and layout standardization applied to the Passive Core pages. Additionally, the temporal filtering logic is missing or incorrectly ordered.

## Required Improvements

### 1. UX Standardization
- **Standardize Header:** Apply the `ui-hero` and `ui-label` pattern to the Active Performance page to match the rest of the application.
- **Hierarchy:** Ensure the page follows the same layout weight as the Portfolio and Strategy pages.

### 2. Year Filtering & Chronology
- **Reverse Chronology:** Year filters must be displayed in reverse chronological order, starting with **2026** and moving backward.
- **Cross-Page Filtering:** 
    - On the **Active Performance** tab, clicking a year filter should dynamically filter the metrics and charts below.
    - Implement the same **Year Filter** logic on the **Ledger** page to allow forensic analysis of specific tax years.

---

# Repo Cleanup & Finalization Strategy

Now that the high-integrity work has been merged into `main` and verified via build and tests, we should clean up the redundant artifacts.

## 1. Close Redundant Pull Requests
We will close the following PRs as they have been superseded by our holistic merge:
- **PR #19:** Visual Slop Cleanup
- **PR #18:** Crisis Simulation Hardening
- **PR #17:** Strategic Efficiency Diagnostic
- **PR #15:** Final Build Stabilization (if its fixes are covered by our merge)

## 2. Delete Stale/Polluted Local Branches
Once the PRs are closed, we will delete the local branches to prevent future accidental chaining:
- `feature/visual-slop-cleanup`
- `feature/crisis-stress-audit`
- `feature/strategic-efficiency-diagnostic`
- `feature/strategic-de-slop` (and any other stale 2026-03 branches)

## 3. Reference Cleanup
- The temporary `backup-main-pre-merge` branch can be deleted once you are 100% satisfied with the current `main`.
