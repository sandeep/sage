# Strategic Spec: Narrative Execution Matrix (Rebalancer v3.2)

## 1. Vision
Transform the execution grid from a static list of categories into a **Dynamic Narrative Desk**. Every trade must explicitly answer "Where is the money coming from?" and "What is the strategic goal of this shift?"

## 2. The Narrative Model
Instead of grouping by `asset_class`, we group by **Strategic Intent**.

### A. Narrative Types:
1.  **Rebalance Swap**: `[Source Class] → [Target Class]` (e.g., *Total Stock → Emerging Markets*)
2.  **Fee Optimization**: `[Ticker] → [Native Ticker]` (e.g., *VTI → FZROX*)
3.  **Liquidation**: `[Overweight Class] → [Cash]` (e.g., *Excess Total Stock → Cash*)
4.  **Strategic Buy**: `[Cash] → [Shortfall Class]` (e.g., *Deploy Cash → Bonds*)

## 3. Data Evolution

### A. Meta-Data Injection
Update `islandEngine.ts` and `rebalancer.ts` to include "Provenance" metadata:
- `source_label`: Name of the overweight category or high-fee ticker.
- `target_label`: Name of the shortfall category or target ticker.
- `current_value`: Current $ in the target category.
- `target_value`: Desired $ in the target category.

## 4. UI/UX: The Narrative Grid

### A. Sticky Narrative Card (Left Column)
- **Primary Title**: The Narrative (e.g., **Total Stock $\rightarrow$ Emerging Markets**)
- **The Shift**: Progress bar showing `$5,000` (Current) growing to `$32,000` (Target).
- **Status Badge**: `OVERWEIGHT` (Rose) or `UNDERWEIGHT` (Emerald) context for the target.

### B. The Distribution Row
- Horizontal spread of accounts.
- Sells and Buys for that specific narrative are grouped together.
- Example: Fidelity Taxable shows `SELL VTI`, Fidelity Roth shows `BUY VWO`.

## 5. Success Criteria
1.  **Contextual Integrity**: Every row explains *why* the money is moving and *where* it's moving from.
2.  **Scale Awareness**: The user sees the $5k $\rightarrow$ $32k transition clearly.
3.  **Zero Confusion**: The "Strategic Move" column is no longer just a category name; it's an instruction.
