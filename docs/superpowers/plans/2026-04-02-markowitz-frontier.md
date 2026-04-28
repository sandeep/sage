# Markowitz Efficient Frontier (Python Bridge) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a mathematically sound Markowitz Efficient Frontier using the industry-standard **PyPortfolioOpt** library. This requires a Python-to-TypeScript bridge to execute the quadratic solver locally.

**Architecture:** 
- `optimizer.py`: Python script utilizing `PyPortfolioOpt` and `CVXPY`.
- `mvoBridge.ts`: TypeScript service to execute the Python solver via child process.
- `auditEngine.ts`: Updated to fetch real 50Y data and call the bridge.
- `EfficiencyMapClientV2.tsx`: Render the stable 'Optimal Line' + 'Cloud'.

**Tech Stack:** Python 3, PyPortfolioOpt, TypeScript, Next.js.

---

### Task 1: Python Solver Core

**Files:**
- Create: `src/lib/logic/math/optimizer.py`
- Create: `requirements.txt` (if not existing)

- [ ] **Step 1: Implement the MVO Solver**
Write a Python script that takes a JSON of historical returns and calculates:
1. The Ledoit-Wolf Shrinkage Covariance Matrix.
2. The Global Minimum Variance portfolio.
3. 20 points on the Efficient Frontier (Minimizing variance for target return increments).
4. 500 valid randomized weight permutations for the 'Opportunity Cloud'.

```python
import sys, json
import numpy as np
import pandas as pd
from pypfopt import EfficientFrontier, risk_models, expected_returns

def solve():
    data = json.load(sys.stdin)
    df = pd.DataFrame(data['returns'])
    
    # 1. Expected Returns & Risk
    mu = expected_returns.mean_historical_return(df)
    S = risk_models.CovarianceShrinkage(df).ledoit_wolf()
    
    # 2. Efficient Frontier
    ef = EfficientFrontier(mu, S)
    # ... logic to sweep returns and get points ...
    
    print(json.dumps(result))
```

- [ ] **Step 2: Commit**
```bash
git add src/lib/logic/math/optimizer.py
git commit -m "math: implement PyPortfolioOpt solver script"
```

### Task 2: The TypeScript Bridge

**Files:**
- Create: `src/lib/logic/math/mvoBridge.ts`

- [ ] **Step 1: Implement child_process execution**
Write a service that pipes return data to the Python script and parses the resulting JSON.
```typescript
import { spawn } from 'child_process';

export async function solveEfficientFrontier(returns: any) {
    // spawn python3 src/lib/logic/math/optimizer.py
    // ... handle stdin/stdout ...
}
```

- [ ] **Step 2: Commit**
```bash
git add src/lib/logic/math/mvoBridge.ts
git commit -m "logic: implement Python-to-TypeScript bridge for MVO"
```

### Task 3: Data Orchestration

**Files:**
- Modify: `src/lib/logic/auditEngine.ts`

- [ ] **Step 1: Fetch 50Y Return Matrix**
Update the engine to gather the last 50 years of annual returns for every unique asset in the user's holdings/target.

- [ ] **Step 2: Call the Bridge**
Replace the server-side `lcg()` simulation with a call to `solveEfficientFrontier()`.

- [ ] **Step 3: Commit**
```bash
git add src/lib/logic/auditEngine.ts
git commit -m "logic: integrate MVO bridge into dashboard data pipeline"
```

### Task 4: Visualization (The Frontier Line)

**Files:**
- Modify: `src/app/performance/EfficiencyMapClientV2.tsx`

- [ ] **Step 1: Render the Curve**
Update the Recharts `ScatterChart` to render the `frontierCurve` points as a solid, surgical line.

- [ ] **Step 2: Commit**
```bash
git add src/app/performance/EfficiencyMapClientV2.tsx
git commit -m "ui: render mathematically proven efficient frontier curve"
```

### Task 5: Final Verification

- [ ] **Step 1: Verify Python Deps**
Ensure `pip install pyportfolioopt pandas` is handled or documented.

- [ ] **Step 2: Build & Check**
Run `npm run build`. Verify the Efficiency Map shows a smooth curve and a stable cloud.
