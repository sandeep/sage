# Alpha Portfolio Tracker — Design Spec

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build an isolated active-trading performance tracker inside sage at `/alpha` that ingests Robinhood transaction CSVs and monthly statement PDFs, reconstructs a daily NAV curve, and computes institutional-grade performance metrics across three books: futures, options, and equities.

**Architecture:** Completely isolated from the passive portfolio — separate `alpha_*` DB tables, separate routes, no joins with passive tables. Integrated into sage's nav as a single additional link. RSC-first, same patterns as the rest of sage.

**Data sources:**
- Transaction CSV (Robinhood export, 2024 → present)
- Monthly equity statement PDFs (2019 → present, ~86 files)
- Monthly futures statement PDFs (Nov 2024 → present, ~17 files)

---

## Section 1: Data Model

```sql
-- Seeded at bootstrap. CME standard specs.
CREATE TABLE alpha_futures_specs (
    symbol      TEXT PRIMARY KEY,   -- 'SIL', 'ES', 'MES', 'NQ', 'MNQ', 'GC', 'MGC', 'CL'
    name        TEXT NOT NULL,
    multiplier  REAL NOT NULL,      -- dollar value per 1 full point move, per contract
    tick_size   REAL NOT NULL,
    tick_value  REAL NOT NULL
);

-- Raw rows from the transaction CSV
CREATE TABLE alpha_transactions (
    id              INTEGER PRIMARY KEY,
    source_file     TEXT NOT NULL,
    activity_date   TEXT NOT NULL,  -- YYYY-MM-DD
    instrument      TEXT,
    description     TEXT,
    trans_code      TEXT NOT NULL,  -- STO, BTC, BTO, STC, OEXP, OASGN, OEXCS, Buy, Sell, FUTSWP, ACH, INT, ...
    quantity        REAL,
    price           REAL,
    amount          REAL,           -- positive = credit, negative = debit
    book            TEXT NOT NULL   -- 'FUTURES_CASH' | 'OPTION' | 'EQUITY' | 'DEPOSIT' | 'FEE' | 'INCOME'
);

-- Individual fills from futures monthly PDFs
CREATE TABLE alpha_futures_fills (
    id               INTEGER PRIMARY KEY,
    source_file      TEXT NOT NULL,
    trade_date       TEXT NOT NULL,
    symbol           TEXT NOT NULL,
    contract_month   TEXT NOT NULL,  -- e.g. '2026-03'
    qty_long         REAL NOT NULL DEFAULT 0,
    qty_short        REAL NOT NULL DEFAULT 0,
    trade_price      REAL NOT NULL,
    multiplier       REAL NOT NULL,  -- copied from alpha_futures_specs at import time
    UNIQUE(source_file, trade_date, symbol, contract_month, trade_price, qty_long, qty_short)
);

-- Reconstructed futures round trips (from fills)
CREATE TABLE alpha_futures_trades (
    id              INTEGER PRIMARY KEY,
    symbol          TEXT NOT NULL,
    contract_month  TEXT NOT NULL,
    direction       TEXT NOT NULL,  -- 'LONG' | 'SHORT'
    open_date       TEXT NOT NULL,
    open_price      REAL NOT NULL,
    close_date      TEXT NOT NULL,
    close_price     REAL NOT NULL,
    qty             REAL NOT NULL,
    net_pnl         REAL NOT NULL,  -- (close - open) * qty * multiplier for LONG, reversed for SHORT
    hold_days       INTEGER NOT NULL
);

-- Reconstructed options round trips (from CSV transactions)
CREATE TABLE alpha_option_trades (
    id              INTEGER PRIMARY KEY,
    instrument      TEXT NOT NULL,   -- underlying ticker
    option_key      TEXT NOT NULL,   -- full description string (e.g. "HOOD 8/8/2025 Call $105.00")
    option_type     TEXT NOT NULL,   -- 'CALL' | 'PUT'
    strike          REAL,
    expiry          TEXT,
    direction       TEXT NOT NULL,   -- 'SHORT' (STO-led) | 'LONG' (BTO-led)
    open_date       TEXT NOT NULL,
    open_code       TEXT NOT NULL,   -- STO or BTO
    open_qty        REAL NOT NULL,
    open_premium    REAL NOT NULL,   -- net amount received/paid on open
    close_date      TEXT,
    close_code      TEXT,            -- BTC, STC, OEXP, OASGN, OEXCS, or NULL if still open
    close_qty       REAL,
    close_premium   REAL,
    net_pnl         REAL,            -- NULL if still open
    outcome         TEXT,            -- 'EXPIRED' | 'CLOSED' | 'ASSIGNED' | 'EXERCISED' | 'OPEN'
    hold_days       INTEGER
);

-- Reconstructed equity round trips (FIFO)
CREATE TABLE alpha_equity_trades (
    id              INTEGER PRIMARY KEY,
    instrument      TEXT NOT NULL,
    open_date       TEXT NOT NULL,
    open_price      REAL NOT NULL,
    close_date      TEXT,
    close_price     REAL,
    qty             REAL NOT NULL,
    net_pnl         REAL,            -- NULL if still open
    hold_days       INTEGER
);

-- Daily P&L aggregate (computed after any import)
CREATE TABLE alpha_daily_pnl (
    date            TEXT PRIMARY KEY,  -- YYYY-MM-DD
    futures_pnl     REAL NOT NULL DEFAULT 0,   -- sum of FUTSWP net for that day
    options_pnl     REAL NOT NULL DEFAULT 0,   -- realized options P&L closed that day
    equity_pnl      REAL NOT NULL DEFAULT 0,   -- realized equity P&L closed that day
    fees            REAL NOT NULL DEFAULT 0,   -- GOLD, MINT, etc. (negative)
    income          REAL NOT NULL DEFAULT 0,   -- INT, GDBP (positive)
    deposits        REAL NOT NULL DEFAULT 0,   -- ACH in (positive) / ACH out (negative)
    daily_total     REAL NOT NULL DEFAULT 0,   -- sum of above (excluding deposits)
    cumulative_pnl  REAL NOT NULL DEFAULT 0    -- running sum of daily_total
);

-- Month-end NAV from equity statement PDFs
CREATE TABLE alpha_nav_snapshots (
    month               TEXT PRIMARY KEY,   -- YYYY-MM
    opening_balance     REAL NOT NULL,
    closing_balance     REAL NOT NULL,
    source_file         TEXT NOT NULL
);

-- Import log
CREATE TABLE alpha_import_log (
    id              INTEGER PRIMARY KEY,
    imported_at     TEXT NOT NULL,
    source_file     TEXT NOT NULL,
    file_type       TEXT NOT NULL,   -- 'CSV' | 'EQUITY_STATEMENT' | 'FUTURES_STATEMENT'
    period_start    TEXT,
    period_end      TEXT,
    records_parsed  INTEGER,
    status          TEXT NOT NULL,   -- 'OK' | 'DUPLICATE_SKIPPED' | 'ERROR'
    error_msg       TEXT
);
```

---

## Section 2: Ingestion Pipeline

### File type auto-detection

```
CSV extension          → transaction CSV
PDF, first-page text contains:
  "ROBINHOOD DERIVATIVES" → futures statement
  "Individual Investing"  → equity statement (modern format, 2018+)
  "Apex Clearing"         → equity statement (legacy format, pre-2019 — skip gracefully)
```

### Transaction CSV parser

Columns: `Activity Date, Process Date, Settle Date, Instrument, Description, Trans Code, Quantity, Price, Amount`

Trans code → book classification:

| Trans Code | Book |
|------------|------|
| FUTSWP | FUTURES_CASH |
| STO, BTC, BTO, STC, OEXP, OASGN, OEXCS | OPTION |
| Buy, Sell | EQUITY |
| ACH, ACSDIV | DEPOSIT |
| GOLD, MINT, GMPC | FEE |
| INT, GDBP | INCOME |

Amount parsing: strip `$`, `,` and `()` (parentheses = negative). Skip footer disclaimer rows. Skip rows with empty date.

Deduplication: unique on `(activity_date, instrument, trans_code, quantity, amount)`.

### Equity statement PDF parser

Target sections:
- **Account Summary table**: extract Opening Balance and Closing Balance → `alpha_nav_snapshots`
- **Account Activity table**: extract FUTSWP rows as cross-validation against CSV (warn if delta > $1)
- Month extracted from "Date: YYYY-MM-DD" header or "YYYY-MM to YYYY-MM" period line

For 2019–2023 statements: only extract NAV snapshot. Transaction matching relies on CSV for 2024+.

### Futures statement PDF parser

Target section: **Monthly Trade Confirmations table**

Columns: `Trade Date | AT | Qty Long | Qty Short | Subtype | Symbol | Contract Year Month | Exchange | Exp Date | Trade Price | Currency Code | Trade Type | Description`

- Parse each data row
- Look up `multiplier` from `alpha_futures_specs` by symbol
- If symbol unknown: insert with `multiplier = NULL`, flag in import log for manual resolution
- Store in `alpha_futures_fills`
- Contract month format: "2026 3" → "2026-03"

Deduplication: unique constraint on `(source_file, trade_date, symbol, contract_month, trade_price, qty_long, qty_short)`.

### Bulk import UX

- `/alpha/import`: drag-drop zone accepting any mix of CSVs and PDFs
- Process files sequentially (SQLite synchronous)
- Real-time log: "✓ Feb 2026 equity statement — NAV $17,072 | ✓ Feb 2026 futures — 84 fills | ✗ unknown.pdf — unrecognized format"
- On duplicate month: skip with warning (never overwrite)
- After import: trigger recompute of `alpha_futures_trades`, `alpha_option_trades`, `alpha_equity_trades`, `alpha_daily_pnl`

---

## Section 3: Trade Reconstruction

### Futures round trips

For each `(symbol, contract_month)` group, sorted by `trade_date, rowid`:

```
running_position = 0
entry_stack = []   # FIFO queue of (date, price, qty)

for each fill:
    if qty_long > 0:
        entry_stack.push({ date, price: trade_price, qty: qty_long })
        running_position += qty_long
    if qty_short > 0:
        close a LONG position from entry_stack (FIFO)
        running_position -= qty_short
        net_pnl = (trade_price - entry_price) * qty * multiplier
        → insert alpha_futures_trades (direction='LONG')

Reverse for net short positions.
```

When `running_position` returns to 0 after a series of fills → round trip complete.

Overnight positions span multiple dates naturally — the fill timestamps handle this.

**Validation:** Sum of `net_pnl` across all `alpha_futures_trades` for a month should approximately equal sum of FUTSWP credits minus debits from `alpha_transactions` for the same month. Log the delta. Tolerance: ±$50 (small differences from intraday mark-to-market settlement timing).

### Options matching

Group `alpha_transactions` WHERE `book = 'OPTION'` by `description` (the full option spec string, e.g. "HOOD 8/8/2025 Call $105.00").

For each description group, sorted by `activity_date`:
- First STO/BTO → open the position (partial qty tracking)
- Subsequent BTC/STC/OEXP/OASGN/OEXCS → close against the open, FIFO on qty
- A position is "OPEN" until fully closed

Parse `option_key` to extract: `strike` (number after `$`), `expiry` (date string), `option_type` (Call/PUT), `instrument` (first word).

Special outcomes:
- `OEXP` → expired worthless. If STO-led: full premium kept (win). If BTO-led: full debit lost.
- `OASGN` → assigned. Stock buy/sell transaction follows in the CSV — link by date + instrument.
- `OEXCS` → exercised. Same linkage.

### Equity matching (FIFO)

Group `alpha_transactions` WHERE `book = 'EQUITY'` by `instrument`.
Match Buy → Sell chronologically, FIFO on quantity.
Handle assignment-related buys/sells (flag as `assignment_related = true` and exclude from standalone equity P&L to avoid double-counting with the option trade).

---

## Section 4: Performance Engine

### Daily NAV reconstruction

```
For 2024+: daily_nav[t] = daily_nav[t-1] + alpha_daily_pnl[t].daily_total + deposits[t]
Starting nav = alpha_nav_snapshots for the earliest month with a CSV record.

For 2019–2023 (monthly statement NAV only):
  Use opening_balance / closing_balance from alpha_nav_snapshots.
  Within-month NAV: linearly interpolate (for chart display only — not used in metric calculations).
```

### Benchmark (VTI)

- Fetch VTI daily prices using existing `priceRefresh.ts` infrastructure
- Construct hypothetical VTI portfolio: same starting capital, same deposit amounts on same deposit dates
- `vti_nav[t] = shares_held * vti_price[t]` where shares increase on each deposit date

### Metrics (computed from 2024+ daily data where available, full period for TWR)

| Metric | Formula |
|--------|---------|
| Total P&L | sum(daily_total) |
| Total Deposited | sum(deposits where deposits > 0) |
| Net Return % | total_pnl / total_deposited |
| TWR | Π(1 + sub_period_return) − 1, sub-periods split on deposit dates |
| Annualized Return | (1 + TWR)^(365/days) − 1 |
| Volatility | std(daily_return) × √252 |
| Sharpe | (annualized_return − 0.045) / volatility |
| Sortino | (annualized_return − 0.045) / downside_vol (only negative days) |
| Information Ratio | mean(daily_alpha) / std(daily_alpha), where daily_alpha = portfolio_return − vti_return |
| Calmar | annualized_return / abs(max_drawdown) |
| Max Drawdown | max peak-to-trough decline in cumulative NAV |
| CVaR 95% | mean of worst 5% daily returns |

### Per-book trade stats (futures / options / equities separately)

| Stat | Formula |
|------|---------|
| Win Rate | closed_wins / total_closed_trades |
| Avg Winner | mean(net_pnl) WHERE net_pnl > 0 |
| Avg Loser | mean(net_pnl) WHERE net_pnl < 0 |
| Profit Factor | sum(wins) / abs(sum(losses)) |
| Expectancy | (win_rate × avg_winner) + (loss_rate × avg_loser) |
| Avg Hold (days) | mean(hold_days) |

---

## Section 5: UI Pages

### NavBar

Add between Performance and Accounts:
```ts
{ href: '/alpha', label: 'Alpha' }
```

### `/alpha` — Overview Dashboard (RSC)

```
┌─────────────────────────────────────────────────────────┐
│ ALPHA PORTFOLIO                           [Import Data]  │
│ Active trading performance vs passive benchmark          │
├─────────────────────────────────────────────────────────┤
│ Total P&L    TWR      Ann. Return  Sharpe  IR   Calmar  │
│  +$X,XXX    X.X%       X.X%       X.XX   X.XX   X.XX   │
├─────────────────────────────────────────────────────────┤
│ [NAV Curve chart — Your portfolio vs VTI, same capital] │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ Max Drawdown   CVaR 95%   Sortino   Period              │
│    -X.X%        -X.X%     X.XX     Nov 2024 – Mar 2026  │
├─────────────────────────────────────────────────────────┤
│ P&L BY BOOK (monthly bar chart)                         │
│ Futures ■  Options ■  Equities ■                        │
└─────────────────────────────────────────────────────────┘
```

### `/alpha/trades` — Trade Log (RSC + client tabs)

Three tabs: **Futures** | **Options** | **Equities**

Each tab shows:
- Sortable table: Date | Instrument | Direction | Entry | Exit | Hold | P&L | %
- Footer summary row: Win Rate | Avg Winner | Avg Loser | Profit Factor | Expectancy
- Color: green P&L positive, red negative

### `/alpha/import` — Bulk Import (client component)

```
┌─────────────────────────────────────────────────────┐
│ DROP FILES HERE                                      │
│ CSVs and PDFs accepted — any quantity               │
├─────────────────────────────────────────────────────┤
│ Import Log                                           │
│ ✓ 2026-02 equity statement — Opening $45.5k → $17k │
│ ✓ 2026-02 futures — 84 fills, 42 round trips        │
│ ✓ transactions_2024.csv — 270 rows, 163 options     │
│ ⚠ 2016-03 Apex Clearing — format not supported      │
│ ✗ random.pdf — unrecognized format                  │
└─────────────────────────────────────────────────────┘
```

After import: redirect to `/alpha` with fresh data.

---

## Section 6: File Structure

```
src/
  app/
    alpha/
      page.tsx                    # RSC: overview dashboard
      trades/
        page.tsx                  # RSC: trade log shell
        TradeLogClient.tsx        # 'use client': tab switching
      import/
        page.tsx                  # RSC shell
        ImportClient.tsx          # 'use client': drag-drop, upload, log
    api/
      alpha/
        import/route.ts           # POST: receive files, parse, store
        recompute/route.ts        # POST: rebuild derived tables after import

  lib/
    logic/
      alpha/
        parser/
          detectFileType.ts       # auto-detect CSV vs equity PDF vs futures PDF
          csvParser.ts            # parse transaction CSV
          equityStatementParser.ts # extract NAV from equity PDF
          futuresStatementParser.ts # extract fills from futures PDF
        reconstruction/
          futuresTrades.ts        # round-trip reconstruction from fills
          optionTrades.ts         # STO/BTC matching
          equityTrades.ts         # FIFO buy/sell matching
        engine/
          dailyPnl.ts             # aggregate alpha_daily_pnl
          metrics.ts              # Sharpe, IR, Calmar, CVaR, etc.
          benchmark.ts            # VTI comparison NAV
        specs/
          contractSpecs.ts        # CME_SPECS lookup table
```

---

## Notes

- **PDF parsing library**: `pdf-parse` (already available in Node ecosystem, no native deps). Extracts raw text; layout parsed by column position heuristics.
- **Tax treatment**: Futures (section 1256 contracts) get 60% LTCG / 40% STCG regardless of hold time. Not computed in V1 but noted for future tax module.
- **Open positions**: Options and equities with no close event are shown in trades tab as "OPEN" with unrealized P&L computed from current price in `ticker_meta`.
- **Chart library**: Needs to be selected during implementation. Recommend `recharts` (lightweight, RSC-compatible via client wrapper).
