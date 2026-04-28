
-- Migration: Strategic Allocation Ledger
-- Adds start/end dates and performance snapshots to allocation_versions

-- 1. Temporary table to hold old data
CREATE TABLE allocation_versions_old AS SELECT * FROM allocation_versions;

-- 2. Drop old table
DROP TABLE allocation_versions;

-- 3. Create new table with ledger fields
CREATE TABLE allocation_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    snapshot TEXT NOT NULL, -- JSON tree
    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    nominal_return REAL,
    sharpe_ratio REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Restore old data
INSERT INTO allocation_versions (label, snapshot, created_at)
SELECT label, snapshot, created_at FROM allocation_versions_old;

-- 5. Cleanup
DROP TABLE allocation_versions_old;
