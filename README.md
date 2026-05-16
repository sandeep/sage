# SAGE v2.0 (Stable)

**High-Fidelity Wealth Orchestration & Active Alpha Decision Engine**

SAGE is an institutional-grade financial analytics platform that transforms raw brokerage data into deterministic strategic insights. It is physically organized around two behavioral workspaces: **Passive Core** (Index stewardship and strategic rebalancing) and **Active Alpha** (Performance tracking for active trading).

## 🌟 Core Features

### 1. Passive Core & Execution Desk
*   **Island Rebalancer**: A tax-aware execution engine that isolates accounts by tax character (Taxable, Roth, Deferred) and executes intra-account atomic swaps to fix allocation shortfalls without triggering unnecessary taxable events.
*   **Narrative Execution Grid**: Translates complex math into plain-english directives (e.g., `Swap $20k VTIVX → VIIIX`) and automatically splits large orders into manageable tranches.
*   **Forensic Audit Pane**: Every recommended move is backed by an immutable, 3-snapshot data trail, allowing you to visually verify the mathematical truth behind the engine's recommendation.
*   **Automated Fee Optimization**: Identifies expensive funds (e.g., VTIVX) and automatically recommends structurally equivalent, lower-cost alternatives (e.g., FZROX or VIIIX) based on what is available in that specific account.

### 2. Active Alpha Tracker
*   **Multi-Asset Ingestion**: Drag-and-drop support for Broker CSVs and Robinhood Monthly Statement PDFs (Equity and Futures). It handles overlapping statement dates seamlessly with deterministic deduplication.
*   **Automated Trade Reconstruction**: Parses raw fills, cash sweeps, and transaction codes (STO, BTC, FUTSWP) to automatically reconstruct round-trip trades across Futures, Options, and Equities.
*   **Institutional Metrics Engine**: Calculates advanced risk-adjusted metrics (Sharpe, Sortino, Calmar, Information Ratio, MWR, CVaR 95%) using academic-standard Sample Standard Deviation ($n-1$) and strict `NaN` protection.
*   **Shadow VTI Benchmark**: Compares your active trading cash flows against a hypothetical passive Total Stock Market investment to calculate true Dollar Alpha.

## 🏗 Technical Philosophy

1.  **Zero-Slop Data Veracity**: Fail-open is forbidden. The engine enforces strict composition validation (asset weights must sum to exactly 100%), explicit ingestion (unknown tickers are flagged as `UNMAPPED`, never defaulted), and precise floating-point epsilon discipline.
2.  **Database Portability**: While SAGE currently operates locally using SQLite (`sage.db`) for speed and simplicity, the core logic is written in Standard SQL and decoupled from the persistence layer to facilitate future migration to hosted providers (e.g., PostgreSQL).
3.  **Mathematical Defensive Programming**: All geometric means and ratios are protected against catastrophic negative bases and division-by-zero errors.

## 🚀 Getting Started

### Prerequisites
*   Node.js 18+
*   npm

### Installation & Setup
```bash
# 1. Clone the repository and install dependencies
npm install

# 2. Start the development server
npm run dev

# (The database 'sage.db' will be automatically seeded or migrated on start/test if required)
```

### Running the Test Suite
SAGE maintains a rigorous, data-driven test suite covering parser logic, complex metric calculations, and the execution engine.
```bash
npm test
```

## 📂 Project Structure

*   `src/app/`: Next.js App Router (UI components, pages, and API routes).
    *   `/passive`: The Passive Core dashboard and Execution Desk.
    *   `/alpha`: The Active Alpha dashboard, trade log, and import tools.
*   `src/lib/db/`: Database client (`better-sqlite3`), schema migrations, and registry seeding.
*   `src/lib/ingest/`: CSV parsing, PDF parsing, and raw data ingestion.
*   `src/lib/logic/`: The core business logic, decoupled from the UI.
    *   `/alpha`: Trade reconstruction engines and mathematical performance metrics.
    *   `/rebalance`: The Island Rebalancer, tax placement, and wash-sale guards.
*   `docs/superpowers/`: Detailed implementation plans, design specs, and architectural decisions.

---
*Built under a mandate of absolute data integrity.*
