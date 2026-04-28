import db from '../client';
import { runMigrations } from '../migrate';
import { seedAllocation } from '../seed_allocation';

export function setupTestDb() {
    // 1. Full Schema Initialization (Safe for isolated test DBs)
    runMigrations(db);

    // 2. Clear Data
    db.exec(`
        DELETE FROM holdings_ledger;
        DELETE FROM accounts;
        DELETE FROM asset_registry;
        DELETE FROM ticker_meta;
        DELETE FROM price_history;
        DELETE FROM allocation_nodes;
        DELETE FROM allocation_versions;
        DELETE FROM user_settings;
        DELETE FROM directives;
        DELETE FROM simulation_cache;
        DELETE FROM wash_sale_lockouts;
    `);

    // 3. Seed Baselines
    db.exec(`
        INSERT INTO user_settings (key, value) VALUES ('ordinary_tax_rate', 0.35);
        INSERT INTO user_settings (key, value) VALUES ('dividend_tax_rate', 0.15);
        INSERT INTO user_settings (key, value) VALUES ('risk_free_rate', 0.05);
        INSERT INTO user_settings (key, value) VALUES ('max_tranche_size', 20000);
    `);

    seedAllocation();
}
