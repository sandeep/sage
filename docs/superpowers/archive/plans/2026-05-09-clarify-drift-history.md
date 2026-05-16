# Issue: Clarify "Drift History" Label and Functionality

## Status
- **Priority:** Medium
- **Category:** UX / Clarity
- **Target Page:** `src/app/passive/allocation/page.tsx` (Strategy Page)

## Problem Statement
The "Drift History" label on the Strategy page is currently unclear to users. It lacks sufficient context regarding its purpose, what it represents, and why it is a critical component of the strategy dashboard.

## Intended Purpose & Value
The **Drift History** is designed to provide a longitudinal view of how the actual portfolio has diverged from the Target Strategy (the "Model") over time. 

### Why it's there:
1.  **Forensic Rebalancing:** It helps users understand if the portfolio is drifting due to market volatility or specific asset class overperformance.
2.  **Tax Sensitivity:** By showing the *rate* of drift, it helps determine the urgency of a rebalance versus the tax cost of execution.
3.  **Stability Audit:** It validates that the rebalancing engine is working; a successful rebalance should show the drift returning toward zero in the history.

## Proposed Remediation (Future Task)
- **Tooltips:** Add a high-fidelity tooltip to the label explaining the "Actual vs. Target" delta.
- **Visual Cues:** Ensure the chart uses consistent color coding (e.g., Emerald for Target, Zinc for Actual/Drift).
- **IA Labeling:** Consider renaming to "Strategic Divergence" or "Allocation Drift" if "Drift History" remains too technical.

## References
- Design Spec: `docs/superpowers/specs/2026-03-16-allocation-slider-redesign.md`
- Implementation Plan: `docs/superpowers/plans/2026-03-16-allocation-and-data-refresh.md`
