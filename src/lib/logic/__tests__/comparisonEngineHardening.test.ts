
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getComparisonData } from '../comparisonEngine';
import db from '../../db/client';
import { runMigrations } from '../../db/migrate';

describe('comparisonEngine Hardening', () => {
    beforeEach(() => {
        runMigrations(db);
    });

    it('getComparisonData should return crisis data with real numbers', async () => {
        // We need some data in the DB for getComparisonData to work fully, 
        // but it should work even with empty holdings by falling back to strategy.
        
        // Mocking/Seeding strategy
        db.prepare('DELETE FROM strategy').run();
        db.prepare("INSERT INTO strategy (category, weight) VALUES ('US Total Stock Market', 0.6)").run();
        db.prepare("INSERT INTO strategy (category, weight) VALUES ('Total Int''l Stock Market', 0.4)").run();

        // Seed some accounts
        db.prepare('DELETE FROM accounts').run();
        db.prepare("INSERT INTO accounts (id, provider, tax_character, account_type) VALUES ('acc1', 'FIDELITY', 'DEFERRED', 'INVESTMENT')").run();
        
        // Seed some holdings for accounts
        db.prepare('DELETE FROM holdings_ledger').run();
        db.prepare(`INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, market_value, asset_type) 
                    VALUES (date('now'), 'acc1', 'FZROX', 1000, 10000, 'EQUITY')`).run();

        const result = await getComparisonData('portfolio');
        
        expect(result).toHaveProperty('crisisData');
        expect(result).toHaveProperty('vti');
        expect(result.vti).not.toBeNull();
        
        // Check if Stagflation (1973-1974) has data
        const stagflation = result.crisisData.find(p => p.name === 'Stagflation');
        expect(stagflation).toBeDefined();
        // Since we have 60-year trailing window (from 2025), 1973-1974 should be covered.
        expect(stagflation.vti).not.toBeNull();
        expect(stagflation.target).not.toBeNull();

        // Check if Dot-com has data
        const dotcom = result.crisisData.find(p => p.name === 'Dot-com');
        expect(dotcom.vti).not.toBeNull();
        expect(dotcom.target).not.toBeNull();

        // Check if GFC has data
        const gfc = result.crisisData.find(p => p.name === 'GFC');
        expect(gfc.vti).not.toBeNull();
        expect(gfc.target).not.toBeNull();
    });
});
