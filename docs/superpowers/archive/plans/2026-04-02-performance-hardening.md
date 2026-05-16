# Forensic Performance Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore mathematical integrity to the Performance page. Fix blank crisis simulations, implement real Efficient Frontier math, and unify the "cluster-fuck" UI layout.

---

### Task 1: UI & Contrast Normalization

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/performance/page.tsx`
- Refactor all components in `src/app/performance/`

- [ ] **Step 1: Harden Global Typography**
Lock section headers to 18px and labels to 11px. Brighten Zinc-500/600 to ensure readability on black.

- [ ] **Step 2: Apply Unified Table Standard**
Standardize all tables to `px-10 py-5` with `border-zinc-900/50`.

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "style: systematic normalization of performance UI"
```

### Task 2: Simba Engine Hardening (Crisis Sim)

**Files:**
- Modify: `src/lib/logic/simbaEngine.ts`
- Modify: `src/lib/logic/comparisonEngine.ts`

- [ ] **Step 1: Fix Mapping Gaps**
Update `TICKER_TO_SIMBA` to include every ticker in the user's registry (VIIIX, FSPSX, etc).

- [ ] **Step 2: Implement Specific Year Simulation**
Modify `calculateHistoricalProxyReturns` to allow querying specific non-trailing years (1973, 2000, 2008).

- [ ] **Step 3: Revive Crisis Simulation**
Update `computeCrisisDrawdown` to use the fixed mapping.

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "logic: fix mapping gaps and revive crisis simulation"
```

### Task 3: Real Efficient Frontier (Markowitz)

**Files:**
- Modify: `src/app/performance/EfficiencyMapClientV2.tsx`

- [ ] **Step 1: Implement Weight Permutation Simulation**
Replace random noise with a 1,000-permutation simulation using the actual historical returns/vols of the portfolio's constituents.

- [ ] **Step 2: Commit**
```bash
git add src/app/performance/EfficiencyMapClientV2.tsx
git commit -m "math: implement real Markowitz frontier simulation"
```

### Task 4: High-Integrity Documentation

- [ ] **Step 1: Create Forensic Methodology Readme**
Document every calculation (Monte Carlo, MVO, Crisis) in `docs/METHODOLOGY.md`.

- [ ] **Step 2: Add mouseover tips**
Add Tooltip components to every header on the Performance page.
```
