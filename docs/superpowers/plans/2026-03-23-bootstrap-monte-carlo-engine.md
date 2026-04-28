# Bootstrap Monte Carlo Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Implement a probabilistic simulation engine based on the Portfolio Visualizer methodology. It will generate 10,000 synthetic futures by "shuffling" historical market years from the Simba dataset to calculate "Success Probabilities" for specific goals.

**Architecture:** 
1. **The Sampler:** Randomly selects historical years (preserving correlations).
2. **The Simulator:** Runs 10,000 paths of 30 years each.
3. **The Evaluator:** Calculates success % for Wealth Preservation, Milestones, and Withdrawals.
4. **The Visualizer:** Renders a Recharts "Success Funnel" (percentile cone).

**Tech Stack:** TypeScript, simple-statistics, Recharts.

---

### Task 1: The Core Simulation Engine

**Files:**
- Create: `src/lib/logic/montecarlo/sampler.ts`
- Create: `src/lib/logic/montecarlo/simulator.ts`
- Test: `src/lib/logic/montecarlo/__tests__/simulator.test.ts`

 - [x] **Step 1: Install Dependencies.**
(Note: simple-statistics should be added if not present).
 - [x] **Step 2: Implement the Year Sampler.**
Logic to pick a random year from 1972-2025 and return returns for all assets + CPI.
 - [x] **Step 3: Implement the Simulator Loop.**
Run 10,000 paths. Use `Float64Array` for performance as per spec review.
 - [x] **Step 4: Implement percentile math.**
Use `simple-statistics` to extract 10th, 50th, and 90th percentiles.
 - [x] **Step 5: Commit.**
```bash
git commit -m "feat: implement core bootstrap monte carlo simulator"
```

### Task 2: Goal Evaluators

**Files:**
- Create: `src/lib/logic/montecarlo/evaluator.ts`

 - [x] **Step 1: Implement Preservation Logic.**
(Success = End Real Value >= Start Value).
 - [x] **Step 2: Implement Milestone Logic.**
(Success = Hitting $X by Year N).
 - [x] **Step 3: Implement Withdrawal Logic.**
(Success = Not hitting $0 given X% draw).
 - [x] **Step 4: Commit.**
```bash
git commit -m "feat: implement monte carlo survival goal evaluators"
```

### Task 3: The Success Funnel UI

**Files:**
- Create: `src/app/components/SuccessFunnel.tsx`
- Create: `src/app/api/performance/montecarlo/route.ts`

 - [x] **Step 1: Build the API.**
Expose the simulator via a POST request that accepts goal configurations.
 - [x] **Step 2: Implement the AreaChart.**
Render the 10/50/90 percentile cone using Recharts.
 - [x] **Step 3: Build the Success Verdict.**
Show a large "Success Probability" score (e.g., 94%).
 - [x] **Step 4: Commit.**
```bash
git commit -m "feat: implement monte carlo success funnel and dashboard integration"
```

### Task 4: Dashboard Integration

**Files:**
- Modify: `src/app/performance/page.tsx`

 - [x] **Step 1: Inject the Monte Carlo section.**
Place it below the Stress Audit as the final "Probabilistic Proof."
 - [x] **Step 2: Final build and verification.**
```bash
npm run build
```
