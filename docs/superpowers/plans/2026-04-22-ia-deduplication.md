# Performance IA De-Duplication Plan

**Goal:** Eliminate visual redundancy on the Performance page by consolidating structural audits and unifying cycle metrics into single sources of truth.

---

## 1. Physical Consolidation Map

| Content | CURRENT State (Redundant) | TARGET State (Unified) |
| :--- | :--- | :--- |
| **Tax Placement** | Cost Center AND Resilience Audit | **Structural Cost Center** (Delete from Resilience) |
| **Long-Run Metrics**| Performance Grid AND Resilience Audit | **Performance Over Time** (Delete from Resilience) |
| **Directives Link** | No link from Audit to Trades | **Cross-Links** added to Cost Center |

---

## 2. Implementation Tasks

### Task 1: De-slop the Resilience Audit
**Files:** `src/app/performance/ResilienceAuditV2.tsx`
*   Physically delete the `TaxPlacementTableV2` import and usage.
*   Physically delete the `ComparisonMetricGridV2` import and usage.
*   **Result:** The "Crisis Simulation" section now strictly contains the physical stress-test table and its description.

### Task 2: Implement "Jump-Link" Navigation
**Files:** `src/app/performance/page.tsx`
*   Add a sticky, high-contrast navigation rail at the top:
    `[ REALIZED ] [ STRUCTURAL ] [ THEORETICAL ] [ STRATEGIC ]`
*   Anchor these to the four logical "Layers" of the report.

### Task 3: Cross-Console Interactivity
**Files:** `src/app/performance/StructuralCostCenter.tsx`
*   Add a high-signal link to every "Optimization" item: `[ VIEW TRADE → ]`.
*   Clicking it takes the user back to `/` and focuses the relevant Directive.

---

**Does this de-duplication and interactivity plan meet your requirements?** I will wait for your confirmation to execute.
