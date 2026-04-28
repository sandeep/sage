# Specification: Content-Addressable Simulation Cache

## 1. Executive Summary
The Audit page currently recalculates complex 50-year historical simulations on every mount, leading to UI latency and unnecessary CPU load. This spec defines a **Content-Addressable Cache** that keys simulation results by the hash of the portfolio/target weights and the system date.

## 2. Strategic Objectives
- **Sub-10ms Loads:** Resolve cached simulations instantly if the portfolio composition hasn't changed.
- **Cache Integrity:** Automatically invalidate results if holdings, target weights, or the `TODAY_ANCHOR` change.
- **Persistence:** Store full simulation series (NAV points) and metrics (Sharpe, M2) in the database.

## 3. Architecture

### A. The Cache Key (The Hash)
The key will be a SHA-256 hash of a JSON object containing:
1. `weights`: The exact weight map (Asset -> %) being simulated.
2. `horizon`: The year range (e.g., 50Y).
3. `anchorDate`: The `TODAY_ANCHOR` (e.g., '2026-03-20').
4. `engineVersion`: Internal version to force cache clears on math logic updates.

### B. Database Schema
A new table `simulation_cache` will be created:
```sql
CREATE TABLE simulation_cache (
    hash TEXT PRIMARY KEY,
    horizon_label TEXT NOT NULL,
    results_json TEXT NOT NULL, -- Full HorizonResult blob
    series_json TEXT NOT NULL,  -- Chart NAV points
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### C. Logic Flow
1. **Frontend/API Request:** Asks for 50Y simulation for Weights `W`.
2. **Hash Generation:** Compute `H = hash(W, 50Y, '2026-03-20')`.
3. **Lookup:** `SELECT * FROM simulation_cache WHERE hash = H`.
4. **Hit:** Return `results_json` instantly.
5. **Miss:** Run `simbaEngine`, store result in `simulation_cache`, then return.

## 4. Performance Standards
- **Write:** < 50ms (Once per portfolio change).
- **Read:** < 5ms (Standard for SQLite indexed primary key).
- **Storage:** < 100KB per cached horizon.

## 5. Implementation Roadmap
1. Create `simulation_cache` table.
2. Implement `getSimulationHash()` utility.
3. Refactor `auditEngine.ts` to wrap simulation calls in the cache layer.
4. Verify instant page reloads.
