
import { describe, it, expect, beforeEach } from 'vitest';
import { calculatePortfolioEfficiency } from '../efficiency';
import db from '../../db/client';
import { setupTestDb } from '../../../lib/db/__tests__/setup';

describe('efficiency', () => {
    beforeEach(() => {
        setupTestDb();
    });

    it('calculates tax drag when inefficient assets are in taxable accounts', () => {
        // Setup: $100k REIT in Taxable, with a Roth available (so it's flagged as misplaced)
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'FIDELITY', 'TAXABLE')").run();
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc2', 'FIDELITY', 'ROTH')").run();
        db.prepare("INSERT INTO holdings (account_id, ticker, quantity, asset_type, market_value) VALUES ('acc1', 'FSRNX', 1000, 'EQUITY', 100000)").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type) VALUES ('FSRNX', 'REIT', '{\"REIT\":1.0}', 'ETF')").run();
        db.prepare("INSERT INTO ticker_meta (ticker, yield, er) VALUES ('FSRNX', 0.04, 0.0007)").run();

        const metrics = calculatePortfolioEfficiency();
        // 100k * 4% yield * (35% - 0% ideal) = $1,400 drag
        // 1400 / 100,000 * 10,000 = 140 bps
        expect(metrics.locationDragBps).toBeCloseTo(140, 0);
    });
});
