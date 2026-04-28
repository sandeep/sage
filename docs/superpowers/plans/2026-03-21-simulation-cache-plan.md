# Implementation Plan: Content-Addressable Simulation Cache

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Accelerate the Audit page by caching historical simulations in the database.

**Architecture:** Implement a hashing layer that keys simulations by weights + dates. Use SQLite for persistent storage of results.

**Tech Stack:** TypeScript, Crypto (SHA-256), better-sqlite3.

---

### Task 1: Database Hardening (Schema)

**Files:**
- Create: `src/lib/db/migrations/005_simulation_cache.sql`
- Modify: `src/lib/db/migrate.ts`

 - [x] **Step 1: Create the migration file.**
```sql
CREATE TABLE IF NOT EXISTS simulation_cache (
    hash TEXT PRIMARY KEY,
    horizon_label TEXT NOT NULL,
    results_json TEXT NOT NULL,
    series_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
 - [x] **Step 2: Apply the migration.**
Run: `npx tsx src/lib/db/migrate.ts`
Expected: Table `simulation_cache` created in `sage.db`.
 - [x] **Step 3: Commit DB changes.**

### Task 2: Cashing Logic (The Hashing Layer)

**Files:**
- Create: `src/lib/logic/simulationCache.ts`
- Test: `src/lib/logic/__tests__/simulationCache.test.ts`

 - [x] **Step 1: Implement SHA-256 hashing.**
Build a utility that stable-stringifies weights + horizon + anchorDate and returns a hash.
 - [x] **Step 2: Implement get/set DB operations.**
Methods to fetch a cached result or store a new one.
 - [x] **Step 3: Write tests for stable hashing.**
Ensure `{"A": 0.1, "B": 0.2}` and `{"B": 0.2, "A": 0.1}` produce the same hash.
 - [x] **Step 4: Commit logic layer.**

### Task 3: API Integration (Audit Engine)

**Files:**
- Modify: `src/lib/logic/auditEngine.ts`
- Modify: `src/app/api/performance/comparison/route.ts`

 - [x] **Step 1: Refactor auditEngine.ts.**
Wrap `calculateHistoricalProxyReturns` calls in the `getSimulationCache` check.
 - [x] **Step 2: Implement background warmup.**
If a cache miss occurs, the engine should run the simulation and persist it automatically.
 - [x] **Step 3: Verify page speed.**
Verify that switching tabs between horizons is now instantaneous (< 50ms).
 - [x] **Step 4: Commit integration.**

### Task 4: Final Validation
 - [x] **Step 1: Check build status.**
Run: `npm run build`
Expected: PASS.
 - [x] **Step 2: Verify Privacy compatibility.**
Ensure masked/unmasked states don't affect the hash (hashing should happen on raw numbers).
 - [x] **Step 3: Final cleanup.**
