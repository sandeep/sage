# Specification: Unified Portfolio Ledger (Time-Machine Architecture)

## 1. Executive Summary
This document defines the transition from a static "Current Holdings" model to a versioned **Immutable Ledger**. It consolidates all portfolio data into a single time-series table, where the "Active State" is dynamically resolved as the most recent snapshot.

## 2. Strategic Objectives
- **Immutable History:** Never overwrite data. Every upload is preserved as a timestamped milestone.
- **Unified Logic:** Treat current performance and historical evolution as two points on the same continuous line.
- **Backward Compatibility:** Use Database Views to ensure existing components (Rebalancer, X-Ray) continue to function without modification.
- **Simplified Ingestion:** A single date-stamped entry point for all portfolio data.

## 3. Data Architecture

### 3.1. The Ledger Table (`holdings_ledger`)
Replaces the `holdings` table.
- `id`: PK.
- `snapshot_date`: DATE (The effective date of the holdings).
- `account_id`: (FK to accounts).
- `ticker`: (Ticker symbol).
- `quantity`: (Number of shares).
- `cost_basis`: (Total cost).
- `market_value`: (Value at snapshot).
- `created_at`: (System timestamp).

### 3.2. The "Source of Truth" View (`current_holdings`)
A SQL View that resolves the latest data:
```sql
CREATE VIEW current_holdings AS 
SELECT * FROM holdings_ledger 
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM holdings_ledger);
```

## 4. Ingestion Workflow (Zero-Fluff)

### 4.1. Single-Field Date Capture
The `MainImporter` UI is updated with a mandatory `Snapshot Date` field (defaults to `TODAY`).

### 4.2. Append-Only Logic
The upload API (`/api/upload`) will no longer `DELETE FROM holdings`. It will `INSERT` into `holdings_ledger` using the provided `snapshot_date`.

## 5. UI & Visualization Impacts

### 5.1. Performance Evolution
The Evolution Chart on the Audit page will now query the `holdings_ledger` to plot historical risk/reward dots.

### 5.2. Historical Navigator (Future)
This architecture enables a "Portfolio Date Picker" where the entire dashboard can be viewed as it appeared on any historical date.

## 6. Technical Constraints & Componentization
- **Database Hardening:** Migration must safely move existing `holdings` data into the new ledger with a `TODAY` timestamp.
- **Module Independence:** The "Snapshot Resolver" logic must be encapsulated in the DB client layer.
- **Line Limits:** Every logic module must be **< 250 lines**.
