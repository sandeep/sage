# Recommendation Clarity & IA Cleanup Plan

**Goal:** Resolve the "Unknown" grouping bug and clarify "SELL" intent (Cash vs. Swap) in the rebalance queue.

---

## 1. Physical Nomenclature Standard

| Current Ambiguity | NEW Precision Label | Logic |
| :--- | :--- | :--- |
| "Trim $20k FZROX" | **"Trim $20k FZROX (Move to Cash)"** | Explicitly signals a liquidation to cash. |
| "Swap VTIVX → FZROX" | **"Swap VTIVX → FZROX in [Account]"** | Includes account name to fix UI grouping. |
| "Relocate FXNAX" | **"Relocate FXNAX to [Account]"** | Clearly defines source and destination. |

---

## 2. Implementation Tasks

### Task 1: Refactor Directive Generation
**Files:** `src/lib/logic/rebalancer.ts`
*   **Step 1:** Update the "Structural Pass" to physically append the account name to the `description` string.
*   **Step 2:** Update the `frictionBridge` or the mapper to append `(Move to Cash)` to all standalone `SELL` directives.

### Task 2: TaskBlotter Forensic Audit
**Files:** `src/app/components/TaskBlotter.tsx`
*   **Step 1:** Verify the `parseAccount` regex correctly extracts the account name from the new structural strings.
*   **Step 2:** Ensure the `tranche` logic handles these new clarified descriptions correctly.

---

**Does this plan to clarify the "Cash" destination and fix the "Unknown" grouping meet your requirements?** I will wait for your confirmation to execute.
