# Issue 3: Efficient Frontier Verification and Stabilization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the mathematical soundness of the Efficient Frontier calculation, stabilize its performance, and add robust error handling and logging.

**Architecture:** This plan focuses on hardening the existing Python-to-TypeScript bridge (`mvoBridge.ts` and `optimizer.py`) and adding a dedicated test suite to validate the MVO (Mean-Variance Optimization) logic against known edge cases.

**Tech Stack:** TypeScript, Python, PyPortfolioOpt, Vitest

---

### Task 1: Verify Python Dependencies

**Files:**
- Modify: `requirements.txt`

- [ ] **Step 1: Check and add dependencies**

Ensure `numpy`, `pandas`, and `pypfopt` are in `requirements.txt`.

```text
# requirements.txt
numpy
pandas
PyPortfolioOpt
```

- [ ] **Step 2: Install dependencies**

Run: `pip install -r requirements.txt`
Expected: Successful installation of all packages.

---

### Task 2: Enhance Python Optimizer Script

**Files:**
- Modify: `src/lib/logic/math/optimizer.py`

- [ ] **Step 1: Add input validation**

Add checks for the number of data points per asset.

```python
# Add after line 28
        min_periods = 10  # Require at least 10 years of data
        for col in returns_df.columns:
            if returns_df[col].count() < min_periods:
                print(json.dumps({"error": f"Asset {col} has fewer than {min_periods} data points"}), file=sys.stderr)
                return

```

- [ ] **Step 2: Improve error logging in solver loops**

Add more descriptive logging when the solver fails.

```python
# In the loop for efficient frontier points, inside the `except` block:
                print(f"Warning: Could not solve for target return {target}", file=sys.stderr)
                continue
```

---

### Task 3: Create a Test Suite for the MVO Bridge

**Files:**
- Create: `src/lib/logic/math/mvoBridge.test.ts`

- [ ] **Step 1: Write the basic test structure**

```typescript
// src/lib/logic/math/mvoBridge.test.ts
import { describe, it, expect } from 'vitest';
import { solveEfficientFrontier } from './mvoBridge';

describe('solveEfficientFrontier', () => {
  it('should return a valid frontier for good data', async () => {
    const returns = {
      stock: [0.1, 0.12, 0.15, 0.08, 0.09, 0.11, 0.14, 0.13, 0.1, 0.12],
      bond: [0.02, 0.03, 0.025, 0.04, 0.035, 0.03, 0.02, 0.03, 0.04, 0.035],
    };
    const result = await solveEfficientFrontier(returns);
    expect(result.points.length).toBeGreaterThan(0);
    expect(result.cloud.length).toBe(500);
  });
});
```

- [ ] **Step 2: Add test for highly correlated assets**

```typescript
  it('should handle highly correlated assets', async () => {
    const returns = {
      stock1: [0.1, 0.12, 0.15, 0.08, 0.09, 0.11, 0.14, 0.13, 0.1, 0.12],
      stock2: [0.101, 0.121, 0.151, 0.081, 0.091, 0.111, 0.141, 0.131, 0.101, 0.121],
    };
    const result = await solveEfficientFrontier(returns);
    expect(result.points.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 3: Add test for assets with no variance**

```typescript
  it('should fail gracefully for assets with no variance', async () => {
    const returns = {
      stock: [0.1, 0.12, 0.15, 0.08, 0.09, 0.11, 0.14, 0.13, 0.1, 0.12],
      cash: [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02],
    };
    await expect(solveEfficientFrontier(returns)).rejects.toThrow();
  });
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/logic/math/mvoBridge.test.ts`
Expected: All tests should pass, except for the "no variance" test which should fail as expected. After the Python script is hardened, it should return a proper error, and the test can be updated to assert for that error.

---

### Task 4: Verify UI and Commit

- [ ] **Step 1: Visually inspect the Efficient Frontier**

Run the application and navigate to the `/passive` page. The "Efficient Frontier" chart should render a smooth curve.

- [ ] **Step 2: Commit all changes**

```bash
git add requirements.txt src/lib/logic/math/optimizer.py src/lib/logic/math/mvoBridge.test.ts
git commit -m "feat: stabilize and verify efficient frontier calculation"
```
