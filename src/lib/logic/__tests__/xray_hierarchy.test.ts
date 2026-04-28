
import { describe, it, expect, beforeEach } from 'vitest';
import { calculateHierarchicalMetrics } from '../xray';
import db from '../../db/client';
import { setupTestDb } from '../../../lib/db/__tests__/setup';
import { TODAY_ANCHOR } from '../referenceDates';

describe('calculateHierarchicalMetrics hierarchy', () => {
    beforeEach(() => {
        setupTestDb();
    });

    it('returns empty array when no holdings exist', () => {
        const result = calculateHierarchicalMetrics();
        expect(result).toEqual([]);
    });

    it('includes Total Portfolio as the first row', () => {
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'FIDELITY', 'TAXABLE')").run();
        db.prepare("INSERT OR REPLACE INTO asset_registry (ticker, canonical, description, asset_type, weights, is_core) VALUES ('VTI', 'Total Stock', '', 'ETF', '{\"Total Stock Market\":1.0}', 0)").run();
        db.prepare("INSERT INTO holdings (account_id, ticker, quantity, asset_type) VALUES ('acc1', 'VTI', 10, 'EQUITY')").run();
        db.prepare("INSERT INTO price_history (ticker, date, close) VALUES ('VTI', ?, 200.00)").run(TODAY_ANCHOR);

        const metrics = calculateHierarchicalMetrics();
        expect(metrics.length).toBeGreaterThan(0);
        expect(metrics[0].label).toBe('Total Portfolio');
        expect(metrics[0].actualValue).toBe(2000);
    });

    it('calculates Other / Uncategorized for tickers not in Level 0 categories', () => {
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'FIDELITY', 'TAXABLE')").run();
        db.prepare("INSERT OR REPLACE INTO asset_registry (ticker, canonical, description, asset_type, weights, is_core) VALUES ('DOGE', 'Crypto', '', 'EQUITY', '{}', 0)").run();
        db.prepare("INSERT INTO holdings (account_id, ticker, quantity, asset_type) VALUES ('acc1', 'DOGE', 1000, 'EQUITY')").run();
        
        db.prepare("INSERT INTO price_history (ticker, date, close) VALUES ('DOGE', ?, 0.15)").run(TODAY_ANCHOR);
        db.prepare("INSERT OR REPLACE INTO price_history (ticker, date, close) VALUES ('VTI', ?, 200)").run(TODAY_ANCHOR);

        const metrics = calculateHierarchicalMetrics();
        const uncat = metrics.find(m => m.label === 'Other / Uncategorized');
        expect(uncat).toBeDefined();
        expect(uncat!.actualValue).toBe(150);
    });
});
