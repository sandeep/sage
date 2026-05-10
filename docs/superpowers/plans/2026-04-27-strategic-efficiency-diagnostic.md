# Strategic Efficiency Diagnostic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a dual-frontier diagnostic that reveals Selection Error vs. Execution Error by comparing the user's specific assets against the global broad-market universe.

**Architecture:** 
1.  Extend the `AuditReport` type.
2.  Update the `auditEngine` to calculate two separate Efficient Frontiers using the Python bridge.
3.  Update the UI to plot both lines and provide a forensic breakdown of the efficiency gap.

**Tech Stack:** TypeScript, Next.js, Python (PyPortfolioOpt)

---

### Task 1: Update Types

**Files:**
- Modify: `src/lib/types/audit.ts`

- [ ] **Step 1: Add globalFrontierPoints to AuditReport**

```typescript
export interface AuditReport {
    // ... existing fields ...
    frontierPoints: {
        points: Array<{ vol: number; return: number; isCurve: boolean }>;
        cloud: Array<{ vol: number; return: number; isCurve: boolean }>;
    };
    globalFrontierPoints: {
        points: Array<{ vol: number; return: number; isCurve: boolean }>;
    };
    // ...
}
```

---

### Task 2: update Audit Engine

**Files:**
- Modify: `src/lib/logic/auditEngine.ts`

- [ ] **Step 1: Implement dual frontier calculation**
Update the logic to call the solver twice.

```typescript
    // --- 5. EFFICIENT FRONTIER MVO BRIDGE ---
    const GLOBAL_STRATEGIC_UNIVERSE = ['TSM', 'INTL', 'SCV', 'EM', 'REIT', 'ITT'];
    
    // Logic to build 'returnMatrixLocal' and 'returnMatrixGlobal'
    // ... (Use existing helper logic to extract years and returns)
    
    // Solve Local
    const localFrontier = await solveEfficientFrontier(returnMatrixLocal);
    
    // Solve Global
    const globalFrontier = await solveEfficientFrontier(returnMatrixGlobal);
```

- [ ] **Step 2: Add Caching support for both**
Ensure the cache hash accounts for the universe type.

---

### Task 3: Update UI Visualization

**Files:**
- Modify: `src/app/passive/EfficiencyMapClientV2.tsx`

- [ ] **Step 1: Render two lines on the ScatterChart**
Emerald line for Local, Zinc/Dashed line for Global.

- [ ] **Step 2: Update Forensic Takeaway**
Calculate the "Selection Gap" (Global Frontier return @ current vol - Local Frontier return @ current vol).

---

### Task 4: Verify and Commit

- [ ] **Step 1: Verify build**
Run: `npm run build`

- [ ] **Step 2: Commit**
```bash
git add .
git commit -m "feat: implement Strategic Efficiency Diagnostic (Global vs Local Frontier)"
```
