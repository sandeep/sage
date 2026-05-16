# QOL Improvements & IA Rationalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Streamline navigation, simplify dashboard labels, and badge unproven engines as "Experimental".

**Architecture:** 
1. **Dynamic Settings:** Migrate `MAX_TRANCHE_SIZE` to the database.
2. **Navigation Guards:** Force console switches to land on the first tab.
3. **UI Filtering:** Update `TaskBlotter` to filter tranches based on "First Pending" logic.
4. **Honesty Badges:** Implement a `BetaTag` component for unverified analytical engines.

---

### Task 1: Performance IA Naming Upgrade

**Files:**
- Modify: `src/app/performance/PerformanceGridV2.tsx`
- Modify: `src/app/performance/EfficiencyMapV2.tsx`
- Modify: `src/app/performance/PerformanceBridgeV2.tsx`
- Modify: `src/app/performance/ResilienceAuditV2.tsx`
- Modify: `src/app/performance/SuccessProbabilityV2.tsx`
- Modify: `src/app/performance/StrategicEvolutionV2.tsx`

- [ ] **Step 1: Apply final IA Names**
1. Grid -> "Performance Over Time"
2. Map -> "Efficient Frontier"
3. Bridge -> "Performance Bridge"
4. Resilience -> "Crisis Simulation"
5. Success -> "Survival Funnel"
6. Evolution -> "Strategic Drift"

---

### Task 2: Institutional "Experimental" Badging

**Files:**
- Modify: `src/app/performance/EfficiencyMapV2.tsx`
- Modify: `src/app/performance/ResilienceAuditV2.tsx`
- Modify: `src/app/performance/SuccessProbabilityV2.tsx`

- [ ] **Step 1: Add the Experimental Badge**
Add a small, high-contrast tag next to the section titles.
*   "Efficient Frontier [EXPERIMENTAL]"
*   "Crisis Simulation [DATA GAP]"
*   "Survival Funnel [EXPERIMENTAL]"

---

### Task 3: Cache Miss Loading States

**Files:**
- Modify: `src/app/performance/SuccessFunnelClientV2.tsx`
- Modify: `src/app/performance/EfficiencyMapClientV2.tsx`

- [ ] **Step 1: Implement Skeletons**
During a cache miss (loading: true), show a pulsing shimmer that says "Executing Historical Simulation...".

---

### Task 4: Final Validation

- [ ] **Step 1: Smoke Test**
1. All sections correctly labeled? ✅
2. Experimental badges visible? ✅
3. Loading states appear during math execution? ✅
