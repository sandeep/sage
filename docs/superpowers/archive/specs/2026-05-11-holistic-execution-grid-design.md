# Strategic Spec: Holistic Execution Grid (Rebalancer v3.1)

## 1. Vision
Transform the fragmented "Task Blotter" into a professional-grade **Execution Desk**. The system must present every trade instruction within its broader strategic context, allowing the user to see how a single allocation change (e.g., "Increase Emerging Markets") is distributed across multiple physical accounts.

## 2. The Problem
*   **Context Fragmentation**: Users must jump between the "Allocation Table" (The Why) and the "Task List" (The How).
*   **Execution Friction**: It is difficult to see the aggregate total of a strategic move when it is split into chunks across different accounts.
*   **IA Cognitive Load**: Toggling between "View by Account" and "View by Category" creates unnecessary friction.

## 3. High-Integrity Architecture

### A. Data Layer: The Strategic Matrix
The frontend will pivot the flat `directives` array into a 2D Matrix.
- **Rows (Y-Axis)**: Strategic Moves.
    - Rebalance: `(source_asset_class, target_asset_class)`
    - Optimization/Placement: `(asset_class)`
- **Columns (X-Axis)**: Physical Accounts.
    - Derived from the unique set of `account_id`s present in the active queue.

### B. Logic: Grouping & Aggregation
- **Strategic Goal Mapping**: Every directive must be associated with a "Goal" label.
- **Deduplication**: The engine will continue to utilize the "Zero-Regex" model to ensure only the next actionable tranche is presented.
- **Equilibrium Logic**: The grid must display all asset classes (even those in equilibrium) to provide a holistic view of the portfolio state.

## 4. UI/UX: The Execution Grid

### A. Layout Structure
- **Sticky Strategic Column (Left)**: Fixed during horizontal scroll. Contains the Strategic Goal name and the Total Notional value for that move.
- **Account Columns**: Each account (e.g., Fidelity Roth) gets a dedicated vertical column.
- **Horizontal Scroll**: For wide account lists, the table will scroll horizontally while keeping the left column fixed.

### B. Cell Design (Trade Cards)
- **Action Pills**: "BUY", "SELL", "SWAP", "OPTIMIZE" using standard semantic colors.
- **Details**: Ticker and USD Amount in high-contrast system monospace.
- **Controls**: "Accept" or "Mark Executed" buttons integrated directly into the cell.
- **Empty States**: Cells with no trades for a specific account/move pair show a muted dash (`—`).

### C. Visual Styles
- **Fonts**: Strict adherence to the existing system font stack.
- **Status Colors**: 
    - Emerald: Actionable/Accepted.
    - Zinc: Pending/Wait-state.
    - Muted/Strikethrough: Executed/Equilibrium.

## 5. Success Criteria
1.  **Contextual Clarity**: The user can identify the "Goal" for every trade without leaving the table.
2.  **Zero Guesswork**: Trades are grouped by physical account with 100% ID-based accuracy.
3.  **Horizontal Scale**: The UI remains usable for portfolios with 5+ accounts.
