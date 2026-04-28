# Performance IA & Immutable Cache Specification

**Goal:** Establish a high-fidelity information architecture for the Performance Suite and a robust, immutable caching layer for mathematical simulations.

---

## 1. Information Architecture (High-Performance Mapping)

| Component | Title | Subtitle |
| :--- | :--- | :--- |
| PerformanceGrid | **Performance Over Time** | Realized returns vs. cycle benchmarks |
| EfficiencyMap | **Efficient Frontier** | Risk/Reward frontier and alpha leakage |
| PerformanceBridge | **Performance Bridge** | Sources of realized performance drift |
| ResilienceAudit | **Crisis Simulation** | Peak-to-trough stress test history |
| SuccessProbability | **Survival Funnel** | Monte Carlo wealth outcomes & reliability |
| StrategicEvolution | **Strategic Drift** | Historical target allocation revisions |

---

## 2. Immutable Cache Ledger Specification

### Architectural Pillars:
1. **Zero-Deletion Policy:** The `simulation_cache` table is a permanent ledger. We never `DELETE` or `TRUNCATE` rows. Every computation result is a permanent record of a specific state.
2. **Deterministic Hashing:** We use SHA-256 to generate a key from the **Input Return Matrix** + **Engine Version**.
3. **Lazy Evaluation:** If a cache hit fails, we compute once and persist. Every subsequent request for that *exact same data set* is O(1) database lookup.

### Physical Key Generation:
```typescript
const hashInput = JSON.stringify({ 
    returns: sortedReturnMatrix, 
    v: ENGINE_VERSION, 
    anchor: TODAY_ANCHOR 
});
const cacheHash = crypto.createHash('sha256').update(hashInput).digest('hex');
```

---

## 3. High-Integrity Validation (The "Flip" Test)

We will implement an automated test suite to ensure the cache correctly invalidates when the asset mix changes.

**Test Case: `cache-fidelity.test.ts`**
*   **Step 1:** Run MVO for Portfolio A. Capture DB row count.
*   **Step 2:** Run MVO for Portfolio A again. Verify **zero** row count change (Cache Hit).
*   **Step 3:** Run MVO for Portfolio B (different mix). Verify row count **increases** by 1 (New simulation persisted).
*   **Step 4:** Run MVO for Portfolio A again. Verify it still exists and is returned correctly.

---

**Does this specification meet your requirements?** I will wait for your approval before writing the implementation plan.
