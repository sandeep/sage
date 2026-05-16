# Human Signal Cleanup Plan

**Goal:** Physically purge visual noise (subtitles, capture ratios) and align headlines with high-performance terminology.

---

## 1. Physical Purge List

*   **Subtitles:** Delete all muted explanatory text under section headers.
*   **Capture Ratios:** Remove the "Capture (U/D)" column from Risk Adjusted Performance.
*   **Internal Headers:** Remove redundant "Concentration Risk" and "Event Severity Audit" titles inside components.

## 2. Headline Alignment

| Component | NEW Title |
| :--- | :--- |
| PerformanceGrid (Wealth) | **Nominal Performance** |
| PerformanceGrid (Risk) | **Risk Adjusted Performance** |
| CostCenter | **Excess Costs and Tax Inefficiency** |
| RiskWidget | **Concentration Risk** |
| ResilienceAudit | **Crisis Simulation** |

## 3. Technical Hardening
*   **Fix Hydration:** Add `useEffect` mounted guard to `PerformanceGridClientV2.tsx` to resolve the Next.js mismatch error.

---

**Does this final cleanup plan meet your requirements?** I will wait for your confirmation to execute.
