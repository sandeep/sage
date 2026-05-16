# MVO Simulation Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permanently eliminate the 1-second rendering delay on the Performance page by caching Markowitz Efficient Frontier results in the `simulation_cache` table.

**Architecture:** 
1. **Unified Storage:** Reuse the existing `simulation_cache` table with a new `MVO_FRONTIER` horizon label.
2. **High-Integrity Hashing:** Use the existing SHA-256 hashing logic to ensure the cache invalidates if tickers or historical anchor dates change.
3. **Transparent Interception:** Modify the `auditEngine.ts` to check the cache before spawning the Python process.

---

### Task 1: Extend Cache Module for MVO Types

**Files:**
- Modify: `src/lib/logic/simulationCache.ts`

- [ ] **Step 1: Add MVO Interfaces**

```typescript
export interface MVOPoint {
    vol: number;
    return: number;
    isCurve: boolean;
}

export interface MVOResponse {
    points: MVOPoint[];
    cloud: MVOPoint[];
}
```

- [ ] **Step 2: Add MVO Cache Helpers**
Implement `getCachedMVO` and `saveCachedMVO` to handle the specific MVO JSON structures.

---

### Task 2: Implement Cache Interception in Audit Engine

**Files:**
- Modify: `src/lib/logic/auditEngine.ts`

- [ ] **Step 1: Generate MVO Hash**
Use `generateSimulationHash` with the current `uniqueAssets` and `TODAY_ANCHOR`.

- [ ] **Step 2: Add Cache Check Guard**
Wrap the `solveEfficientFrontier` call. If cache hits, skip Python entirely.

```typescript
const cacheHash = generateSimulationHash(returnMatrix as any, 'MVO_FRONTIER', TODAY_ANCHOR);
const cached = getCachedMVO(cacheHash);
if (cached) {
    frontierPoints = cached;
} else {
    frontierPoints = await solveEfficientFrontier(returnMatrix);
    saveCachedMVO(cacheHash, frontierPoints);
}
```

---

### Task 3: Final Validation

- [ ] **Step 1: Physical Performance Test**
1. Load Performance page (Wait 1s).
2. Refresh Performance page.
3. **Success Criteria:** Refresh completes in < 50ms. ✅
4. Console shows zero errors. ✅

- [ ] **Step 2: Commit**
```bash
git add .
git commit -m "perf: implement high-integrity MVO simulation caching"
```
