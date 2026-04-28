# Design Spec: Sage (The Logic Wrapper)
**Date:** 2026-03-14
**Status:** Draft
**Topic:** Orchestrating Post-Institutional Wealth Management Through Agentic Logic Wrappers

## 1. Executive Summary
Sage is a private, agentic financial operating system for high-net-worth individuals. Unlike traditional aggregators (Mint/Empower), Sage focuses on **prescriptive orchestration**. It prioritizes "Asset Location" over "Asset Allocation" by mapping every dollar to its most efficient tax venue (Roth, 401k, Taxable) and provides a "Look-Through" analysis to manage true security concentration.

## 2. Goals & Success Criteria
- **Alpha Validation:** Determine if the Alpha portfolio (Commodities/Options/1256) is outperforming VTI on a risk-adjusted (Sharpe/Sortino) basis.
- **Tail-Hedge Analysis:** Verify if the Alpha sleeve provides negative correlation/downside protection during core market drawdowns.
- **Concentration Management:** Identify hidden risk by "cracking open" ETFs to calculate total exposure to individual securities (e.g., NVDA).
- **Agentic Rebalancing:** Generate step-by-step directives that optimize for tax efficiency (1256 rules, wash-sale prevention).
- **Auditability:** Maintain a persistent, versionable history of state and directives in both SQLite and Markdown.

## 3. Core Modules

### 3.1 The Account Architect (Truth Layer)
- **Persistent Registry:** SQLite tables mapping Account IDs to \"Tax Character\" (Roth, Tax-Deferred, Taxable).

- **Manual Ingestion:** Air-gapped processing of CSV/JSON holdings exports from Fidelity, Schwab, and Vanguard.
- **Tax DNA:** Storage of account-specific tax rules (e.g., "Taxable: 1256 Mark-to-Market", "Roth: Tax-Free Growth").

### 3.2 The Look-Through Mapper (Asset X-Ray)
- **Functional Composition:** Decomposes fund tickers (VTI, VXUS) into their top underlying holdings.
- **True Concentration Logic:**
  - $C_{total}(S) = S_{direct} + (ETF_{value} \times S_{fund\_weight})$
- **Alerting:** Flags when a single security's true concentration exceeds a user-defined risk threshold (e.g., > 10% total portfolio).

### 3.3 The Alpha Engine Analyst
- **Instrument Tracking:** Specialized logic for Commodities, Currency, and Options (Section 1256).
- **Performance Metrics:**
  - Sharpe Ratio (Volatility-adjusted return).
  - Sortino Ratio (Downside-risk adjusted return).
  - Correlation coefficient relative to VTI.
- **Rebalance Trigger:** $\gamma_{ceiling}$ activation when Alpha weight deviates from target.

### 3.4 The Agentic Blotter (Decision Support)
- **Interactive Task List:** Next.js web interface for managing active rebalance directives.
- **Directives Mirror:** Continuous sync of "Active Directives" and "Portfolio State" to `/sage/directives/` and `/sage/state/` as Markdown/Text files.
- **Audit Trail:** Longitudinal history of all proposed and accepted rebalances stored in SQLite.

## 4. Technical Architecture

### 4.1 Stack
- **Frontend/Backend:** Next.js (App Router).
- **Persistence:** SQLite (`better-sqlite3`) for relational history.
- **File Mirroring:** Node.js `fs` module for Markdown/Text synchronization.
- **Calculations:** Math.js or specialized financial utility library for Ratios/Calculus.

### 4.2 Data Model (High-Level)
- `accounts`: `id, provider, tax_character, purpose`
- `holdings`: `id, account_id, ticker, quantity, cost_basis, type (Equity/1256/Option), timestamp`
- `etf_composition`: `fund_ticker, asset_ticker, weight`
- `directives`: `id, type, description, priority, status (Pending/Accepted/Snoozed), created_at`
- `performance_snapshots`: `id, bucket (Core/Alpha), value, return_ytd, sharpe, sortino, timestamp`

## 5. User Experience (UX)
- **Signal-over-Noise:** Minimalist, text-dense dashboard prioritizing the "Next Best Move."
- **Task-Driven:** A clear checklist of "Directives" with "Reasoning" provided for every move (e.g., "Wash-Sale Risk Avoided").
- **Historical View:** Charts showing Alpha performance vs. VTI and Tail-Hedge benchmarks.

## 6. Implementation Plan (Phased)
1. **Phase 1: Truth Layer & Ingestion.** SQLite schema + CSV parsers for Fidelity/Schwab.
2. **Phase 2: Asset X-Ray.** ETF decomposition logic and True Concentration reporting.
3. **Phase 3: Alpha Analyst.** Risk-adjusted performance calculations and benchmarking.
4. **Phase 4: Agentic Blotter.** Next.js UI + Markdown mirroring of directives.
