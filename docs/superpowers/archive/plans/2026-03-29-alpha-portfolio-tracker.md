# Alpha Portfolio Tracker — Implementation Plan

**Goal:** Build an isolated active-trading performance tracker inside sage at `/alpha` that ingests Robinhood transaction CSVs and monthly statement PDFs, reconstructs a daily NAV curve, and computes institutional-grade performance metrics.

---

## Task Breakdown

### Task 1: Database Schema & Seeding
- [x] **Step 1:** Create 10 new `alpha_*` tables in `migrate.ts`.
- [x] **Step 2:** Seed CME futures specs (ES, MES, NQ, MNQ, GC, MGC, CL, MCL, SI, SIL).
- [x] **Step 3:** Ensure migrations are stable for multi-worker environments.

### Task 2: Ingestion Pipeline
- [x] **Step 1:** Implement `detectFileType.ts` for CSV and PDF auto-detection.
- [x] **Step 2:** Implement `csvParser.ts` for Robinhood transaction ingestion with book classification.
- [x] **Step 3:** Implement `equityStatementParser.ts` for NAV extraction from monthly PDFs.
- [x] **Step 4:** Implement `futuresStatementParser.ts` for fill extraction from futures PDFs.

### Task 3: Trade Reconstruction
- [x] **Step 1:** Implement `futuresTrades.ts` (FIFO matching for fills).
- [x] **Step 2:** Implement `optionTrades.ts` (STO/BTC matching with special outcomes like OEXP).
- [x] **Step 3:** Implement `equityTrades.ts` (FIFO matching for buy/sell).

### Task 4: Performance Engine
- [x] **Step 1:** Implement `dailyPnl.ts` for P&L aggregation and NAV reconstruction.
- [x] **Step 2:** Implement `metrics.ts` for TWR, Sharpe, Sortino, IR, Calmar, etc.
- [x] **Step 3:** Implement `benchmark.ts` for hypothetical VTI comparison.
- [x] **Step 4:** Implement `tax.ts` for Section 1256 (60/40) tax treatment.

### Task 5: UI Implementation
- [x] **Step 1:** Build `/alpha` Dashboard Overview with NAV chart and institutional metrics.
- [x] **Step 2:** Build `/alpha/trades` Tabbed Trade Log for all asset classes.
- [x] **Step 3:** Build `/alpha/import` Drag-and-Drop Interface with real-time logging.
- [x] **Step 4:** Add "Alpha" link to main `NavBar`.

---

## Status: DONE
All core requirements from the design spec have been implemented and verified.
