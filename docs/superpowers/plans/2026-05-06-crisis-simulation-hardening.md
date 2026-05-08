# Crisis Simulation Restoration & Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore mathematical integrity to the Crisis Simulation table by fixing the UI sign-flip, re-implementing weighted intra-year shocks, and including missing historical events.

**Architecture:** 
1.  Fix the UI logic in `CrisisStressTableV2.tsx`.
2.  Refactor `computeCrisisDrawdown` in `comparisonEngine.ts` to support weighted shocks for specific years (1987, 2020).
3.  Expand `CRISIS_PERIODS` to include 2020 COVID.

**Tech Stack:** TypeScript, React, better-sqlite3

---

### Task 1: Fix UI Logic Flip (Addl. Capital at Risk)

**Files:**
- Modify: `src/app/passive/CrisisStressTableV2.tsx`

- [ ] **Step 1: Correct the resilience calculation**
Update the sign logic. Resilience delta should be `target - actual`. If the actual portfolio loses MORE than the target (e.g., Target -40%, Actual -50%), the delta is positive (+10%) and represents "Addl. Capital at Risk".

```tsx
// Inside CrisisStressTableV2.tsx
const resilienceDelta = (row.target != null && row.actual != null) ? (row.target - row.actual) : 0;
const isAtRisk = resilienceDelta > 0.001; // Positive means Actual lost more than Target
```

---

### Task 2: Harden the Crisis Engine (Weighted Shocks)

**Files:**
- Modify: `src/lib/logic/comparisonEngine.ts`

- [ ] **Step 1: Add 2020 to CRISIS_PERIODS**
```typescript
export const CRISIS_PERIODS = [
    { name: 'Stagflation',    years: [1973, 1974] },
    { name: 'Black Monday',   years: [1987] },
    { name: 'Dot-com',        years: [2000, 2001, 2002] },
    { name: 'GFC',            years: [2008] },
    { name: 'COVID-19',       years: [2020] },
    { name: 'Inflation Surge', years: [2022] },
];
```

- [ ] **Step 2: Update computeCrisisDrawdown to use weights**
The function currently lacks the `weights` needed to compute weighted shocks for single-year events.

```typescript
// Refactor signature to include weights
export function computeCrisisDrawdown(
    annualReturnsByYear: Record<string, number>,
    years: number[],
    isMarket: boolean = false,
    weights?: Record<string, number> // Add weights parameter
): number | null {
    if (years.length === 1 && YEARLY_SHOCKS[String(years[0])]) {
        const shock = YEARLY_SHOCKS[String(years[0])];
        if (isMarket) return shock.vti;
        
        // NEW: Calculate weighted shock for Actual/Strategy
        if (weights) {
            let weightedShock = 0;
            // Map weights to Simba classes and multiply by shocks
            for (const [ticker, weight] of Object.entries(weights)) {
                const simbaClass = TICKER_TO_SIMBA[ticker.toUpperCase()] || LABEL_TO_SIMBA[ticker];
                if (!simbaClass) continue;
                
                const s = simbaClass.toLowerCase();
                const shockVal = s.includes('scv') ? shock.scv :
                                s.includes('reit') ? shock.reit :
                                s.includes('intl') || s.includes('em') ? shock.intl :
                                s.includes('bond') || s.includes('itt') ? shock.bond :
                                shock.vti; // Default to market shock
                
                weightedShock += weight * shockVal;
            }
            return weightedShock;
        }
        return shock.vti; // Fallback if no weights
    }
    // ... existing multi-year sequence logic ...
}
```

- [ ] **Step 3: Update getComparisonData calls**
Pass the `currentWeights` and `strategicWeights` to the updated `computeCrisisDrawdown`.

---

### Task 3: Verify and Commit

- [ ] **Step 1: Verify UI Rendering**
Navigate to `/passive`. Verify the "COVID-19" row is visible. Verify that "Addl. Capital at Risk" only shows up for rows where the Actual portfolio underperforms the Strategy.

- [ ] **Step 2: Final Build Check**
Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: harden crisis simulation with weighted shocks and corrected risk logic"
```
