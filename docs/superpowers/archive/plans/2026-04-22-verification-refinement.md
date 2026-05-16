# Experimental Verification & Table Refinement Plan

**Goal:** Systematically audit unproven math engines for absolute correctness and refactor the "Performance Over Time" table into a professional-grade institutional component.

---

## 1. Experimental Math Audit (The Truth Pass)

We will perform a **Forensic Math Deep-Dive** for each badged section:

### A. Efficient Frontier (MVO)
- [ ] **Data Proof:** Physically verify the covariance matrix generation in `optimizer.py`.
- [ ] **Result Audit:** Cross-reference MVO outputs with a manual Excel Markowitz calculation for a simple 60/40 mix.

### B. Survival Funnel (Monte Carlo)
- [ ] **Regime Audit:** Verify that the 5,000 paths are sampling correctly from the **1970–2024** historical window.
- [ ] **Reliability Proof:** Ensure the "Success Rate" isn't a optimistic hallucination and physically accounts for annual rebalancing.

### C. Crisis Simulation (Proxies)
- [ ] **Wiring Audit:** Resolve the missing institutional proxies for AAPL and FZROX to eliminate "Data Gaps."
- [ ] **Integrity Pass:** Prove that the physical dollar drawdowns match historical Simba reality for the 98/2 Strategy.

---

## 2. Visual Table Refinement (De-slopping the Pipes)

**Problem:** The current "Performance Over Time" table uses pipe characters (`|`) and looks like unformatted raw text.

**Solution: The `InstitutionalGrid` Component**
We will refactor `PerformanceGridV2.tsx` to use a sophisticated visual grid:
*   **Physical Borders:** Use `border-zinc-800` instead of character-based dividers.
*   **Column Alignment:** Use a strict `table-fixed` grid with aligned headers.
*   **Typography:** Use high-contrast weighting (`font-black`) for realized data and muted weighting for benchmarks.
*   **Color-coding:** Sub-headings (Market, Strategy, Portfolio) will use integrated background tints to create visual separation.

---

### Task 1: Refactor Performance Over Time Table
- [ ] **Action:** Physically delete the pipe-based strings.
- [ ] **Action:** Implement the `InstitutionalGrid` with proper CSS borders and semantic alignment.

### Task 2: Mathematical Verification Loop
- [ ] **Action:** Run a one-off "Validation Script" for each experimental engine.
- [ ] **Action:** Remove the "EXPERIMENTAL" badge only after physical verification of the math.

---

**Does this roadmap for absolute correctness and visual polish meet your requirements?** I will wait for your confirmation to execute.
