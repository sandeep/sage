
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = 'sage.db';

function ensureColumn(db, table, column, definition) {
    try {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
        console.log(`Added column ${column} to table ${table}.`);
    } catch (e) {
        if (!e.message.includes('duplicate column name')) {
            console.log(`Failed to add column ${column} to ${table}: ${e.message}`);
        }
    }
}

const MIGRATIONS = [
    `CREATE TABLE IF NOT EXISTS holdings_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT,
        account_name TEXT,
        ticker TEXT,
        quantity REAL,
        cost_basis REAL,
        market_value REAL,
        snapshot_date TEXT,
        is_cash_equivalent INTEGER DEFAULT 0,
        asset_type TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        nickname TEXT,
        provider TEXT,
        tax_character TEXT,
        account_type TEXT,
        value REAL
    );`,
    `CREATE TABLE IF NOT EXISTS strategy (
        category TEXT PRIMARY KEY,
        label TEXT,
        weight REAL
    );`,
    `CREATE TABLE IF NOT EXISTS asset_registry (
        ticker TEXT PRIMARY KEY,
        category TEXT,
        asset_type TEXT,
        canonical TEXT,
        is_core INTEGER,
        custom_er REAL,
        weights TEXT,
        geography TEXT,
        asset_class TEXT,
        proxy_weights TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value REAL,
        updated_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS wash_sale_lockouts (
        ticker TEXT PRIMARY KEY,
        locked_until TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS ticker_meta (
        ticker TEXT PRIMARY KEY,
        name TEXT,
        yield REAL,
        er REAL,
        fiftyTwoWeekLow REAL,
        fiftyTwoWeekHigh REAL,
        return1y REAL,
        close REAL,
        description TEXT,
        website TEXT,
        fetched_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS price_history (
        ticker TEXT,
        date TEXT,
        close REAL,
        fiftyTwoWeekLow REAL,
        fiftyTwoWeekHigh REAL,
        PRIMARY KEY (ticker, date)
    );`,
    `CREATE TABLE IF NOT EXISTS allocation_nodes (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        parent_label TEXT,
        label TEXT,
        weight REAL,
        expected_return REAL,
        is_category INTEGER,
        level INTEGER
    );`,
    `CREATE TABLE IF NOT EXISTS allocation_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT,
        snapshot TEXT,
        start_date TEXT,
        end_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS simulation_cache (
        hash TEXT PRIMARY KEY,
        horizon_label TEXT NOT NULL,
        results_json TEXT NOT NULL,
        series_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`
];

try {
    if (fs.existsSync(DB_PATH)) {
        const backupPath = `${DB_PATH}.backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        console.log(`Pre-migration safety check: Backing up database to ${backupPath}...`);
        fs.copyFileSync(DB_PATH, backupPath);
    }

    console.log('Applying migrations...');
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    
    db.transaction(() => {
        MIGRATIONS.forEach(sql => {
            try {
                db.prepare(sql).run();
            } catch (e) {
                if (!e.message.includes('already exists')) throw e;
            }
        });
    })();

    // Explicitly add missing columns to existing tables for non-destructive upgrades
    ensureColumn(db, 'accounts', 'tax_character', 'TEXT');
    ensureColumn(db, 'accounts', 'account_type', 'TEXT');
    ensureColumn(db, 'asset_registry', 'asset_type', 'TEXT');
    ensureColumn(db, 'asset_registry', 'canonical', 'TEXT');
    ensureColumn(db, 'asset_registry', 'custom_er', 'REAL');
    ensureColumn(db, 'asset_registry', 'weights', 'TEXT');
    ensureColumn(db, 'asset_registry', 'geography', 'TEXT');
    ensureColumn(db, 'asset_registry', 'proxy_weights', 'TEXT');
    ensureColumn(db, 'strategy', 'label', 'TEXT');
    ensureColumn(db, 'ticker_meta', 'name', 'TEXT');
    ensureColumn(db, 'ticker_meta', 'yield', 'REAL');
    ensureColumn(db, 'ticker_meta', 'er', 'REAL');
    ensureColumn(db, 'ticker_meta', 'fiftyTwoWeekLow', 'REAL');
    ensureColumn(db, 'ticker_meta', 'fiftyTwoWeekHigh', 'REAL');
    ensureColumn(db, 'ticker_meta', 'return1y', 'REAL');
    ensureColumn(db, 'ticker_meta', 'close', 'REAL');
    ensureColumn(db, 'ticker_meta', 'fetched_at', 'TEXT');
    ensureColumn(db, 'allocation_nodes', 'label', 'TEXT');
    ensureColumn(db, 'allocation_nodes', 'parent_label', 'TEXT');
    ensureColumn(db, 'allocation_nodes', 'level', 'INTEGER');
    ensureColumn(db, 'allocation_nodes', 'expected_return', 'REAL');
    ensureColumn(db, 'allocation_nodes', 'is_category', 'INTEGER');
    ensureColumn(db, 'allocation_versions', 'label', 'TEXT');
    ensureColumn(db, 'allocation_versions', 'start_date', 'TEXT');
    ensureColumn(db, 'allocation_versions', 'end_date', 'TEXT');

    // Add dynamic tranche size setting
    db.prepare("INSERT OR IGNORE INTO user_settings (key, value) VALUES ('max_tranche_size', 20000)").run();

    // ── Physical View Synchronization ─────────────────────────────────────
    console.log('Synchronizing Enriched View...');
    db.prepare(`DROP VIEW IF EXISTS enriched_holdings;`).run();
    db.prepare(`
        CREATE VIEW enriched_holdings AS
        SELECT 
            h.ticker,
            tm.name as instrument_name,
            ar.asset_type,
            ar.geography,
            ar.weights as internal_categories,
            ar.proxy_weights as simba_proxies,
            SUM(h.market_value) as market_value,
            GROUP_CONCAT(DISTINCT a.nickname) as account_list,
            tm.yield,
            tm.er as expense_ratio,
            (SELECT close FROM price_history ph WHERE ph.ticker = h.ticker ORDER BY date DESC LIMIT 1) as close,
            tm.fiftyTwoWeekLow,
            tm.fiftyTwoWeekHigh,
            tm.return1y
        FROM holdings_ledger h
        JOIN accounts a ON h.account_id = a.id
        LEFT JOIN ticker_meta tm ON h.ticker = tm.ticker
        LEFT JOIN asset_registry ar ON h.ticker = ar.ticker
        WHERE h.snapshot_date = (SELECT MAX(snapshot_date) FROM holdings_ledger)
        GROUP BY h.ticker, ar.geography, ar.asset_type;
    `).run();
    
    db.close();
    console.log('Database schema synchronized successfully.');
} catch (e) {
    console.error('CRITICAL: Database bootstrap failed:', e);
    process.exit(1);
}
