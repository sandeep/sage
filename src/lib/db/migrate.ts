// src/lib/db/migrate.ts
import type Database from 'better-sqlite3';

export function runMigrations(db: InstanceType<typeof Database>) {
    // --- 1. BASE TABLES (Essential for all other operations) ---
    
    db.exec(`CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        tax_character TEXT NOT NULL,
        purpose TEXT
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS asset_registry (
        ticker        TEXT PRIMARY KEY,
        canonical     TEXT NOT NULL,
        description   TEXT,
        asset_type    TEXT,
        weights       TEXT NOT NULL,
        is_core       INTEGER DEFAULT 0,
        index_tracked TEXT,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS ticker_meta (
        ticker           TEXT PRIMARY KEY,
        fetched_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS directives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        reasoning TEXT,
        link_key TEXT,
        executed_at DATETIME,
        final_value REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS etf_composition (
        fund_ticker TEXT NOT NULL,
        asset_ticker TEXT NOT NULL,
        weight REAL NOT NULL,
        PRIMARY KEY (fund_ticker, asset_ticker)
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS allocation_nodes (
        label           TEXT PRIMARY KEY,
        parent_label    TEXT,
        weight          REAL NOT NULL,
        expected_return REAL,
        level           INTEGER NOT NULL
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS allocation_versions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at  TEXT DEFAULT (datetime('now')),
        label       TEXT NOT NULL,
        snapshot    TEXT NOT NULL
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS price_history (
        ticker TEXT NOT NULL,
        date   TEXT NOT NULL,
        close  REAL NOT NULL,
        PRIMARY KEY (ticker, date)
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS strategy (
        category TEXT PRIMARY KEY,
        label    TEXT,
        weight   REAL
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS user_settings (
        key        TEXT PRIMARY KEY,
        value      REAL,
        updated_at TEXT
    )`);

    // --- 2. COLUMN MIGRATIONS (Incremental updates) ---

    // Accounts
    const accountCols = db.prepare("PRAGMA table_info(accounts)").all() as any[];
    if (!accountCols.find((c: any) => c.name === 'nickname')) {
        db.exec("ALTER TABLE accounts ADD COLUMN nickname TEXT");
    }
    if (!accountCols.find((c: any) => c.name === 'account_type')) {
        db.exec("ALTER TABLE accounts ADD COLUMN account_type TEXT");
    }

    // Asset Registry
    const registryCols = db.prepare("PRAGMA table_info(asset_registry)").all() as any[];
    if (!registryCols.find((c: any) => c.name === 'custom_er')) {
        db.exec("ALTER TABLE asset_registry ADD COLUMN custom_er REAL");
    }
    if (!registryCols.find((c: any) => c.name === 'description')) {
        db.exec("ALTER TABLE asset_registry ADD COLUMN description TEXT");
    }
    if (!registryCols.find((c: any) => c.name === 'index_tracked')) {
        db.exec("ALTER TABLE asset_registry ADD COLUMN index_tracked TEXT");
    }
    if (!registryCols.find((c: any) => c.name === 'created_at')) {
        db.exec("ALTER TABLE asset_registry ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    }
    if (!registryCols.find((c: any) => c.name === 'updated_at')) {
        db.exec("ALTER TABLE asset_registry ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    }

    // Ticker Meta
    const metaCols = db.prepare("PRAGMA table_info(ticker_meta)").all() as any[];
    if (!metaCols.find((c: any) => c.name === 'name')) {
        db.exec("ALTER TABLE ticker_meta ADD COLUMN name TEXT");
    }
    if (!metaCols.find((c: any) => c.name === 'yield')) {
        db.exec("ALTER TABLE ticker_meta ADD COLUMN yield REAL");
    }
    if (!metaCols.find((c: any) => c.name === 'er')) {
        db.exec("ALTER TABLE ticker_meta ADD COLUMN er REAL");
    }
    if (!metaCols.find((c: any) => c.name === 'return1y')) {
        db.exec("ALTER TABLE ticker_meta ADD COLUMN return1y REAL");
    }
    if (!metaCols.find((c: any) => c.name === 'fiftyTwoWeekLow')) {
        db.exec("ALTER TABLE ticker_meta ADD COLUMN fiftyTwoWeekLow REAL");
    }
    if (!metaCols.find((c: any) => c.name === 'fiftyTwoWeekHigh')) {
        db.exec("ALTER TABLE ticker_meta ADD COLUMN fiftyTwoWeekHigh REAL");
    }

    // Directives
    const directiveCols = db.prepare("PRAGMA table_info(directives)").all() as any[];
    if (!directiveCols.find((c: any) => c.name === 'account_id')) {
        db.exec("ALTER TABLE directives ADD COLUMN account_id TEXT");
    }
    if (!directiveCols.find((c: any) => c.name === 'asset_class')) {
        db.exec("ALTER TABLE directives ADD COLUMN asset_class TEXT");
    }
    if (!directiveCols.find((c: any) => c.name === 'scheduled_date')) {
        db.exec("ALTER TABLE directives ADD COLUMN scheduled_date TEXT");
    }
    if (!directiveCols.find((c: any) => c.name === 'tranche_index')) {
        db.exec("ALTER TABLE directives ADD COLUMN tranche_index INTEGER NOT NULL DEFAULT 1");
    }
    if (!directiveCols.find((c: any) => c.name === 'tranche_total')) {
        db.exec("ALTER TABLE directives ADD COLUMN tranche_total INTEGER NOT NULL DEFAULT 1");
    }
    if (!directiveCols.find((c: any) => c.name === 'amount')) {
        db.exec("ALTER TABLE directives ADD COLUMN amount REAL");
    }

    // ETF Composition
    const etfCols = db.prepare("PRAGMA table_info(etf_composition)").all() as any[];
    if (!etfCols.find((c: any) => c.name === 'fetched_at')) {
        db.exec("ALTER TABLE etf_composition ADD COLUMN fetched_at TEXT");
    }

    // --- 3. COMPLEX MIGRATIONS (Phases) ---

    // PHASE 4: UNIFIED PORTFOLIO LEDGER MIGRATION
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    const hasLedger = tables.find(t => t.name === 'holdings_ledger');
    const isHoldingsTable = tables.find(t => t.name === 'holdings');

    if (!hasLedger) {
        db.exec(`
            CREATE TABLE holdings_ledger (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_date TEXT NOT NULL,
                account_id TEXT NOT NULL,
                ticker TEXT NOT NULL,
                quantity REAL NOT NULL,
                cost_basis REAL,
                asset_type TEXT NOT NULL,
                market_value REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id)
            );
            CREATE INDEX idx_ledger_date ON holdings_ledger(snapshot_date);
        `);
        console.log('Migration: created holdings_ledger');

        // Migrate data if old table exists and is actually a table (not a view)
        if (isHoldingsTable) {
            try {
                const rowCount = (db.prepare("SELECT COUNT(*) as c FROM holdings").get() as any).c;
                if (rowCount > 0) {
                    db.exec(`
                        INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, cost_basis, asset_type, market_value)
                        SELECT date('now', 'localtime'), account_id, ticker, quantity, cost_basis, asset_type, market_value
                        FROM holdings
                    `);
                    console.log(`Migration: moved ${rowCount} holdings to ledger`);
                }
            } catch (e) {
                console.log('Migration: holdings table empty or already a view');
            }
            
            // Swap table for View
            db.exec("DROP TABLE IF EXISTS holdings");
            db.exec(`
                CREATE VIEW IF NOT EXISTS holdings AS 
                SELECT * FROM holdings_ledger 
                WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM holdings_ledger)
            `);
            console.log('Migration: established holdings source-of-truth view');
        }
    }

    // Ensure holdings view exists
    db.exec(`
        CREATE VIEW IF NOT EXISTS holdings AS 
        SELECT * FROM holdings_ledger 
        WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM holdings_ledger)
    `);

    // Ensure enriched_holdings view exists
    db.exec(`DROP VIEW IF EXISTS enriched_holdings`);
    db.exec(`
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
    `);

    // --- 4. ADDITIONAL UTILITY TABLES ---

    db.exec(`CREATE TABLE IF NOT EXISTS snapshot_metadata (
        snapshot_date TEXT PRIMARY KEY,
        label         TEXT
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS simulation_cache (
        hash          TEXT NOT NULL,
        horizon_label TEXT NOT NULL,
        results_json  TEXT NOT NULL,
        series_json   TEXT NOT NULL DEFAULT '[]',
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (hash, horizon_label)
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS wash_sale_lockouts (
        ticker TEXT PRIMARY KEY,
        locked_until TEXT
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS account_instrument_allowlist (
        account_id TEXT NOT NULL,
        ticker TEXT NOT NULL,
        asset_class TEXT NOT NULL,
        added_at TEXT DEFAULT (date('now')),
        PRIMARY KEY (account_id, ticker)
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS performance_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bucket TEXT NOT NULL,
        value REAL NOT NULL,
        return_ytd REAL,
        sharpe REAL,
        sortino REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // --- 5. ALPHA PORTFOLIO TRACKER TABLES ---

    db.exec(`CREATE TABLE IF NOT EXISTS alpha_futures_specs (
        symbol      TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        multiplier  REAL NOT NULL,
        tick_size   REAL NOT NULL,
        tick_value  REAL NOT NULL
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS alpha_transactions (
        id              INTEGER PRIMARY KEY,
        source_file     TEXT NOT NULL,
        activity_date   TEXT NOT NULL,
        instrument      TEXT,
        description     TEXT,
        trans_code      TEXT NOT NULL,
        quantity        REAL,
        price           REAL,
        amount          REAL,
        book            TEXT NOT NULL
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS alpha_futures_fills (
        id               INTEGER PRIMARY KEY,
        source_file      TEXT NOT NULL,
        trade_date       TEXT NOT NULL,
        symbol           TEXT NOT NULL,
        contract_month   TEXT NOT NULL,
        qty_long         REAL NOT NULL DEFAULT 0,
        qty_short        REAL NOT NULL DEFAULT 0,
        trade_price      REAL NOT NULL,
        multiplier       REAL NOT NULL,
        UNIQUE(source_file, trade_date, symbol, contract_month, trade_price, qty_long, qty_short)
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS alpha_futures_trades (
        id              INTEGER PRIMARY KEY,
        symbol          TEXT NOT NULL,
        contract_month  TEXT NOT NULL,
        direction       TEXT NOT NULL,
        open_date       TEXT NOT NULL,
        open_price      REAL NOT NULL,
        close_date      TEXT NOT NULL,
        close_price     REAL NOT NULL,
        qty             REAL NOT NULL,
        net_pnl         REAL NOT NULL,
        hold_days       INTEGER NOT NULL
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS alpha_option_trades (
        id              INTEGER PRIMARY KEY,
        instrument      TEXT NOT NULL,
        option_key      TEXT NOT NULL,
        option_type     TEXT NOT NULL,
        strike          REAL,
        expiry          TEXT,
        direction       TEXT NOT NULL,
        open_date       TEXT NOT NULL,
        open_code       TEXT NOT NULL,
        open_qty        REAL NOT NULL,
        open_premium    REAL NOT NULL,
        close_date      TEXT,
        close_code      TEXT,
        close_qty       REAL,
        close_premium   REAL,
        net_pnl         REAL,
        outcome         TEXT,
        hold_days       INTEGER
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS alpha_equity_trades (
        id              INTEGER PRIMARY KEY,
        instrument      TEXT NOT NULL,
        open_date       TEXT NOT NULL,
        open_price      REAL NOT NULL,
        close_date      TEXT,
        close_price     REAL,
        qty             REAL NOT NULL,
        net_pnl         REAL,
        hold_days       INTEGER
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS alpha_daily_pnl (
        date            TEXT PRIMARY KEY,
        futures_pnl     REAL NOT NULL DEFAULT 0,
        options_pnl     REAL NOT NULL DEFAULT 0,
        equity_pnl      REAL NOT NULL DEFAULT 0,
        fees            REAL NOT NULL DEFAULT 0,
        income          REAL NOT NULL DEFAULT 0,
        deposits        REAL NOT NULL DEFAULT 0,
        daily_total     REAL NOT NULL DEFAULT 0,
        cumulative_pnl  REAL NOT NULL DEFAULT 0,
        nav             REAL NOT NULL DEFAULT 0
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS alpha_nav_snapshots (
        month               TEXT PRIMARY KEY,
        opening_balance     REAL NOT NULL,
        closing_balance     REAL NOT NULL,
        source_file         TEXT NOT NULL
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS alpha_import_log (
        id              INTEGER PRIMARY KEY,
        imported_at     TEXT NOT NULL,
        source_file     TEXT NOT NULL,
        file_type       TEXT NOT NULL,
        period_start    TEXT,
        period_end      TEXT,
        records_parsed  INTEGER,
        status          TEXT NOT NULL,
        error_msg       TEXT
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS alpha_shadow_vti (
        date TEXT PRIMARY KEY,
        shares REAL NOT NULL,
        price REAL NOT NULL,
        value REAL NOT NULL,
        cumulative_deposits REAL NOT NULL
    )`);

    // --- 6. SEEDING ---

    db.transaction(() => {
        const specCount = (db.prepare("SELECT COUNT(*) as c FROM alpha_futures_specs").get() as any).c;
        if (specCount === 0) {
            const insertSpec = db.prepare(`
                INSERT OR IGNORE INTO alpha_futures_specs (symbol, name, multiplier, tick_size, tick_value)
                VALUES (?, ?, ?, ?, ?)
            `);
            const specs = [
                ['ES',  'E-mini S&P 500', 50, 0.25, 12.50],
                ['MES', 'Micro E-mini S&P 500', 5, 0.25, 1.25],
                ['NQ',  'E-mini Nasdaq 100', 20, 0.25, 5.00],
                ['MNQ', 'Micro E-mini Nasdaq 100', 2, 0.25, 0.50],
                ['GC',  'Gold', 100, 0.10, 10.00],
                ['MGC', 'Micro Gold', 10, 0.10, 1.00],
                ['CL',  'Crude Oil', 1000, 0.01, 10.00],
                ['MCL', 'Micro Crude Oil', 100, 0.01, 1.00],
                ['SI',  'Silver', 5000, 0.005, 25.00],
                ['SIL', 'Micro Silver', 1000, 0.005, 5.00],
            ];
            specs.forEach(s => insertSpec.run(...s));
        }
    })();

    // Holdings Ledger columns
    const ledgerCols = db.prepare("PRAGMA table_info(holdings_ledger)").all() as any[];
    if (ledgerCols.length > 0) {
        if (!ledgerCols.find((c: any) => c.name === 'asset_type')) {
            db.exec("ALTER TABLE holdings_ledger ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'EQUITY'");
        }
        if (!ledgerCols.find((c: any) => c.name === 'snapshot_date')) {
            db.exec("ALTER TABLE holdings_ledger ADD COLUMN snapshot_date TEXT");
        }
    }

    // Daily P&L columns
    const pnlCols = db.prepare("PRAGMA table_info(alpha_daily_pnl)").all() as any[];
    if (!pnlCols.find((c: any) => c.name === 'nav')) {
        db.exec("ALTER TABLE alpha_daily_pnl ADD COLUMN nav REAL DEFAULT 0");
    }
}
