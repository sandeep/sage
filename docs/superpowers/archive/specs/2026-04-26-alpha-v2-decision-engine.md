# Design Spec: Alpha v2 Decision Engine

Date: 2026-04-26
Topic: Alpha Portfolio Benchmarking & Shadow VTI Portfolio

## 1. Objective
To provide a definitive answer to the question: "Is active trading worth my time vs. holding VTI?" by implementing a "Shadow Portfolio" that tracks the opportunity cost of every dollar deposited into the Alpha account.

## 2. Architecture & Data Flow

### 2.1 The Shadow Ledger (Opportunity Cost)
- **Table:** `alpha_shadow_vti`
- **Logic:** For every entry in `alpha_transactions` where `book = 'DEPOSIT'`, we record a hypothetical purchase of VTI shares at that day's closing price.
- **Withdrawals:** If `book = 'WITHDRAWAL'`, we simulate a sale of VTI shares at that day's price.
- **Daily MTM:** A new background job will calculate the daily value of this shadow portfolio using existing `price_history` for VTI.

### 2.2 Asset Class Benchmarking (The Three Gates)
- **Equities:** Use `priceRefresh.ts` to backfill daily price history for all tickers in `alpha_equity_trades`. Calculate MTM daily for the duration the trade was open.
- **Futures:** Continue using daily cash sweeps as the source of truth for MTM.
- **Options:** Use a market-correlated interpolation (Beta to underlying) to estimate daily value between open and close dates.

### 2.3 Key Metrics
- **Dollar Alpha:** `(Actual Alpha NAV) - (Shadow VTI NAV)`.
- **MWR (Money-Weighted Return):** Calculated per asset class to reflect the dollar-weighted reality of capital deployment.
- **Sharpe Ratio Differential:** `(Actual Sharpe) - (VTI Sharpe)` over the same period.

## 3. Implementation Plan Overview
1. **Data Integrity:** Backfill `price_history` for all missing equity tickers.
2. **Shadow Engine:** Implement the ledger logic to generate the `alpha_shadow_vti` series.
3. **Metrics Overhaul:** Update `src/lib/logic/alpha/engine/metrics.ts` to calculate MWR and Dollar Alpha.
4. **UI Update:** Refactor `src/app/alpha/page.tsx` to display the "Three Gates" and the Shadow Comparison.

## 4. Success Criteria
- The dashboard shows the exact dollar amount lost/gained relative to a passive VTI strategy.
- Performance is broken down by Futures, Options, and Equities with appropriate benchmarks.
- The NAV chart overlays the Actual NAV and the Shadow VTI NAV.
