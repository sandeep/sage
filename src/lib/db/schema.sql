-- src/lib/db/schema.sql
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    tax_character TEXT NOT NULL, -- ROTH, DEFERRED, TAXABLE
    purpose TEXT
);

CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    quantity REAL NOT NULL,
    cost_basis REAL,
    asset_type TEXT NOT NULL, -- EQUITY, 1256, OPTION
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS etf_composition (
    fund_ticker TEXT NOT NULL,
    asset_ticker TEXT NOT NULL,
    weight REAL NOT NULL,
    PRIMARY KEY (fund_ticker, asset_ticker)
);

CREATE TABLE IF NOT EXISTS directives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL, -- PENDING, ACCEPTED, SNOOZED, EXECUTED
    reasoning TEXT,
    link_key TEXT,
    executed_at DATETIME,
    final_value REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS performance_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bucket TEXT NOT NULL, -- CORE, ALPHA
    value REAL NOT NULL,
    return_ytd REAL,
    sharpe REAL,
    sortino REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Asset registry (replaces ticker_map.json)
CREATE TABLE IF NOT EXISTS asset_registry (
    ticker        TEXT PRIMARY KEY,
    canonical     TEXT NOT NULL,
    description   TEXT,
    asset_type    TEXT,
    weights       TEXT NOT NULL,
    is_core       INTEGER DEFAULT 0,
    index_tracked TEXT,
    custom_er     REAL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily closing prices (replaces prices.json)
CREATE TABLE IF NOT EXISTS price_history (
    ticker TEXT NOT NULL,
    date   TEXT NOT NULL,
    close  REAL NOT NULL,
    PRIMARY KEY (ticker, date)
);

-- Live-fetched metadata: yield, ER, 1y return (replaces ticker_meta.json)
CREATE TABLE IF NOT EXISTS ticker_meta (
    ticker           TEXT PRIMARY KEY,
    name             TEXT,
    yield            REAL,
    er               REAL,
    return1y         REAL,
    fiftyTwoWeekLow  REAL,
    fiftyTwoWeekHigh REAL,
    fetched_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Live allocation nodes (replaces target_allocation.json reads)
CREATE TABLE IF NOT EXISTS allocation_nodes (
    label           TEXT PRIMARY KEY,
    parent_label    TEXT,
    weight          REAL NOT NULL,
    expected_return REAL,
    level           INTEGER NOT NULL
);

-- Append-only history snapshots
CREATE TABLE IF NOT EXISTS allocation_versions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT DEFAULT (datetime('now')),
    label       TEXT NOT NULL,
    snapshot    TEXT NOT NULL
);
