# Implementation Plan: Robinhood Futures PDF Ingestion Upgrade (v2.0)

**Goal:** Enhance the Alpha section's futures ingestion to capture commissions, fees, and journal entries from Robinhood monthly statement PDFs, ensuring robust deduplication for incremental updates.

## Architecture & Data Model

### 1. Database Hardening (`src/lib/db/migrate.ts`)
We need to upgrade `alpha_futures_fills` to store more granular cost data and fix the uniqueness constraint.

- **`alpha_futures_fills` upgrade**:
    - Add `commission`, `exchange_fees`, `nfa_fees`.
    - Change `UNIQUE` constraint from `(source_file, trade_date, symbol, contract_month, trade_price, qty_long, qty_short)` to `(trade_date, symbol, contract_month, trade_price, qty_long, qty_short)` to prevent cross-file duplicates.
- **`alpha_futures_journal` creation**:
    - New table for tracking cash transfers specific to the futures book.
    - Schema: `id`, `trade_date`, `description`, `amount`, `source_file`.

### 2. Parser Upgrade (`src/lib/logic/alpha/parser/futuresStatementParser.ts`)
The parser will be refactored to handle multiple sections of the PDF.

- **Task 1: Monthly Trade Confirmations (Individual Fills)**
    - Keep existing regex-based extraction for fills.
    - Improve regex to handle potential multi-line descriptions.
- **Task 2: Trade Confirmation Summary (Commissions & Fees)**
    - Parse this table to calculate the per-contract fee for each symbol/date combination.
    - Back-fill the `commission`, `exchange_fees`, and `nfa_fees` into the `alpha_futures_fills` records.
- **Task 3: Journal Entries (Cash Flow)**
    - Parse "Journal Entries" section for `Deposit` and `Withdrawal` rows.
    - Store in `alpha_futures_journal`.

## Implementation Steps

### Task 1: Schema Migration
1.  Modify `src/lib/db/migrate.ts` to add the new columns and the new table.
2.  Since SQLite doesn't support dropping constraints, use the "create new, copy, rename" pattern for `alpha_futures_fills`.
3.  Add a migration step in `src/lib/db/migrate.ts`.

### Task 2: Enhanced PDF Parsing
1.  Update `futuresStatementParser.ts`:
    - Implement a state machine to track which section of the PDF is currently being parsed.
    - **Section: "Monthly Trade Confirmations"**: Capture fills as before.
    - **Section: "Trade Confirmation Summary"**: Capture fees and map them back to the fills based on `date` and `symbol`.
    - **Section: "Journal Entries"**: Capture cash transfers.
2.  Update `src/app/api/alpha/import/route.ts` to handle the multi-record return from the enhanced parser.

### Task 3: Trade Reconstruction Update
1.  Update `src/lib/logic/alpha/reconstruction/futuresTrades.ts` to include commissions/fees in the `net_pnl` calculation.
2.  Ensure that `alpha_futures_journal` entries are reflected in the `alpha_daily_pnl` (as deposits/withdrawals).

## Verification & Testing

### 1. Unit Tests
-   Create a new test file `src/lib/logic/alpha/parser/__tests__/futuresStatementParserV2.test.ts` using the provided sample PDF content.
-   Verify deduplication by "importing" the same content twice with different `sourceFileName`.

### 2. Integration Tests
-   Run `npm run dev` and test a bulk import of the sample PDF.
-   Verify that the "Alpha" dashboard shows the correct P&L (gross - commissions).
-   Check the `alpha_futures_fills` table for non-null commission values.

### 3. Build Check
-   Run `npm run build` to ensure no type regressions.
