# Crisis Simulation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore mathematical integrity to the 'Resilience Audit' by ensuring every major historical crisis (1973, 1987, 2000, 2008, 2022) is fully populated with real reconstructed data.

**Architecture:** 
- `simbaEngine.ts`: Expanded mapping layer and intelligent return fallbacks.
- `comparisonEngine.ts`: 60-year simulation window and weight-based shock estimation.
- `CrisisStressTableV2.tsx`: Cleaned UI with 'Actual' vs 'Strategy' focus.

**Tech Stack:** TypeScript, SQLite, Simba Historical Dataset.

---

### Task 1: Mapping & Window Hardening

**Files:**
- Modify: `src/lib/logic/simbaEngine.ts`
- Modify: `src/lib/logic/comparisonEngine.ts`

- [ ] **Step 1: Synchronize Mapping Layer**
Update `LABEL_TO_SIMBA` in `simbaEngine.ts` to include every exact label from the database (e.g., 'Intl\'l Stock', 'Small Cap Value', 'US Large Cap/SP500/DJIX').

- [ ] **Step 2: Expand Simulation Horizon**
Update `getComparisonData` in `comparisonEngine.ts` to use a 60-year trailing window (1966–2026). This ensures the 1973 Stagflation era is captured.

- [ ] **Step 3: Commit**
```bash
git add src/lib/logic/simbaEngine.ts src/lib/logic/comparisonEngine.ts
git commit -m "logic: harden simba mapping and expand window to 60Y"
```

### Task 2: Intelligent Return Fallbacks

**Files:**
- Modify: `src/lib/logic/simbaEngine.ts`

- [ ] **Step 1: Implement getHistoricalReturn helper**
Refactor the return calculation loop to use a fallback hierarchy:
1. Exact class data for the year.
2. TSM (Total Stock Market) for any Equity-like class missing data.
3. ITT (Treasuries) for any Bond-like class missing data.
4. Cash (0%) for cash.

- [ ] **Step 2: Commit**
```bash
git add src/lib/logic/simbaEngine.ts
git commit -m "logic: implement intelligent proxy fallbacks for ancient crisis data"
```

### Task 3: Forensic Shock Integration

**Files:**
- Modify: `src/lib/logic/comparisonEngine.ts`

- [ ] **Step 1: Refactor computeCrisisDrawdown**
Update the logic to calculate 1987 and 2020 shocks based on actual portfolio weights instead of hardcoded market standard.
```typescript
// Example Logic:
// portfolioShock = (weightSCV * scvShock) + (weightTSM * tsmShock) + ...
```

- [ ] **Step 2: Commit**
```bash
git add src/lib/logic/comparisonEngine.ts
git commit -m "logic: implement weight-based intra-year shock estimation"
```

### Task 4: UI Alignment & Verification

**Files:**
- Modify: `src/app/performance/CrisisStressTableV2.tsx`

- [ ] **Step 1: Final Label Cleanup**
Rename 'Actual (Drift)' to 'Actual'. Ensure all cells use `ui-value`.

- [ ] **Step 2: Build & Verify**
Run `npm run build`. Navigate to `/performance` and verify all rows (1973, 1987, 2000, 2008, 2022) have non-null values.

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "fix: final UI polish for Resilience Audit"
```
