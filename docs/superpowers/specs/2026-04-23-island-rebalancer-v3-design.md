# High-Integrity Island Rebalancer (v3) Design Spec

**Goal:** Replace the fragmented greedy solver with an atomic, tax-aware "Island Engine" that solves global allocation gaps using internal account liquidity.

---

## 1. Physical Laws of the Engine

### A. The Island Constraint
*   **Definition:** No capital transfers between accounts during rebalancing.
*   **Implementation:** Every gap is solved **within the specific account** (Intra-island swap).
*   **Rationale:** Real-world transfers are operationally complex and often unrealistic across different tax characters.

### B. The Tax-Liability Guard (Taxable Only)
*   **Enforcement:** Strictly applied only to **TAXABLE** accounts.
*   **Roth / Traditional IRA:** Exempt from gain-based locking; these accounts prioritize 100% target alignment as sales trigger zero tax.
*   **Logic (Taxable Only):**
    1. Calculate `Unrealized Gain = (Current Value - Cost Basis)`.
    2. If `Unrealized Gain > MAX_GAIN_THRESHOLD`, physically lock the position from being a "Sell" candidate.

---

## 2. The Atomic Solving Algorithm

1.  **Global Gap Detection:** Calculate the delta ($) between Current and Target for every asset class across the entire household.
2.  **Island Strategy Mapping:** 
    *   For every account, identify "Excess" tickers and "Shortfall" asset classes.
    *   Prioritize "Safe Havens" (Roth/IRA) for aggressive swapping.
3.  **Atomic Swap Execution:**
    *   Inside each account, find the best "Excess" ticker to fund a "Shortfall" asset.
    *   Generate a single **"INTRA-ISLAND SWAP"** directive.
4.  **Targeted Liquidation:** 
    *   If an account has "Excess" but no matching "Shortfall" (or vice versa), the engine generates an explicit move to **CASH**.

---

## 3. Physical UI Directives

We throw away "SELL" and "BUY" as isolated actions.

| Type | Description | Reasoning |
| :--- | :--- | :--- |
| **INTRA-ISLAND SWAP** | "Swap $10k FZROX → FXNAX in Fidelity Roth" | Close Bond gap using internal excess. |
| **TARGETED SELL** | "Trim $2k AAPL (Move to Cash) in Taxable" | Explicit liquidation to re-establish cash reserves. |

---

**Does this "Island-Based" specification meet your requirements?** I will wait for your approval before writing the implementation plan.
