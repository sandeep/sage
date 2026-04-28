# Institutional Data Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate "Mapping Chaos" by unifying Strategy Labels and Physical Tickers into a single Simba-capable Asset Registry, while fixing mathematical unit errors in the simulation engine.

**Architecture:** 
1. **Registry Hardening:** Treat Strategy Labels (e.g., 'Total Stock Market') as virtual tickers in the `asset_registry` so Simulation Engines can look them up identically to physical holdings.
2. **Mathematical Normalization:** Enforce `frequency=1` in the Python MVO bridge to match the annual granularity of Simba data.
3. **UI Container Stability:** Use React state guards to prevent Recharts from measuring parent containers before hydration is complete.

**Tech Stack:** SQLite, Python (PyPortfolioOpt), Next.js 16.

---

### Task 1: Virtual Ticker Hardening (The Crisis Fix)

**Files:**
- Create: `scripts/seed_strategic_proxies.ts`
- Modify: `src/lib/logic/comparisonEngine.ts`

- [ ] **Step 1: Create the Strategic Seed Script**
  This script ensures Strategy Labels can be simulated by the Crisis Engine.

```typescript
import db from '../src/lib/db/client';
const strategyMappings = [
    { label: 'Total Stock Market', proxy: '{"TSM": 1.0}' },
    { label: 'Small Cap Value',    proxy: '{"SCV": 1.0}' },
    { label: 'REIT',               proxy: '{"REIT": 1.0}' },
    { label: 'Emerging Market',    proxy: '{"EM": 1.0}' },
    { label: 'Developed Market',   proxy: '{"INTL": 1.0}' },
    { label: 'US Aggregate Bond',  proxy: '{"ITT": 1.0}' },
    { label: 'Cash',               proxy: '{"CASH": 1.0}' }
];
export async function seedStrategicProxies() {
    db.transaction(() => {
        const stmt = db.prepare("INSERT OR REPLACE INTO asset_registry (ticker, canonical, weights, proxy_weights, is_core, description) VALUES (?, ?, ?, ?, 1, ?)");
        for (const m of strategyMappings) {
            stmt.run(m.label, m.label, JSON.stringify({[m.label]: 1.0}), m.proxy, `Virtual Ticker for Strategy Simulation`);
        }
    })();
}
```

- [ ] **Step 2: Run the seed**
Run: `npx ts-node scripts/seed_strategic_proxies.ts`

- [ ] **Step 3: Verify the Crisis Table data pipeline**
Run: `sqlite3 sage.db "SELECT ticker, proxy_weights FROM asset_registry WHERE is_core = 1;"`
Expected: Strategic labels appear with their Simba proxies.

---

### Task 2: MVO Unit Normalization (The Frontier Fix)

**Files:**
- Modify: `src/lib/logic/math/optimizer.py`

- [ ] **Step 1: Update the Python Solver**
Change the expected return and covariance model to use `frequency=1`.

```python
# src/lib/logic/math/optimizer.py
mu = expected_returns.return_model(returns_df, method="mean_historical_return", returns_data=True, frequency=1)
S = risk_models.risk_matrix(returns_df, method="ledoit_wolf", returns_data=True, frequency=1)
```

- [ ] **Step 2: Verify math in isolation**
Run: `python3 src/lib/logic/math/optimizer.py < test_input.json`
Expected: Returns in the `0.05 - 0.15` range, not millions.

---

### Task 3: Layout Hydration Guards (The Console Error Fix)

**Files:**
- Modify: `src/app/performance/EfficiencyMapClientV2.tsx`

- [ ] **Step 1: Add the Mounted Guard**
Prevent rendering the chart until the browser has finished the first paint.

```typescript
const [mounted, setMounted] = React.useState(false);
React.useEffect(() => setMounted(true), []);
if (!mounted) return <div className="aspect-video min-h-[450px] bg-zinc-900/10 animate-pulse" />;
```

---

### Task 4: Commit and Stabilize

- [ ] **Step 1: Final Regression Test**
Navigate to `/performance` and verify:
1. Crisis Table shows data for all rows. ✅
2. Efficiency Map Y-axis shows reasonable percentages (e.g., 0% to 15%). ✅
3. Console has 0 errors. ✅

- [ ] **Step 2: Commit**
```bash
git add .
git commit -m "feat: implement institutional data specification and fix MVO math units"
```
