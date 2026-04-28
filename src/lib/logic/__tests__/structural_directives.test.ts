import { describe, it, expect, beforeEach } from 'vitest';
import { generateDirectives } from '../rebalancer';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';

describe('Structural Directive Integration', () => {
    beforeEach(() => { setupTestDb(); });

    it('should physically convert a Fee Risk into an OPTIMIZATION directive', async () => {
        // Setup a $50k position in expensive VTIVX (10 bps)
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-1', 'FIDELITY', 'TAXABLE')").run();
        db.prepare(`INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, market_value, asset_type) 
                   VALUES (date('now'), 'acc-1', 'VTIVX', 100, 50000, 'ETF')`).run();
        db.prepare("INSERT INTO ticker_meta (ticker, name, er) VALUES ('VTIVX', 'Expensive', 0.001)").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) VALUES ('VTIVX', 'Target', '{\"Total Stock Market\":1}', 'ETF', 0)").run();
        
        // Add a cheaper alternative
        db.prepare("INSERT INTO ticker_meta (ticker, name, er) VALUES ('VTI', 'Cheap', 0.0003)").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) VALUES ('VTI', 'Total Stock Market', '{\"Total Stock Market\":1}', 'ETF', 1)").run();

        await generateDirectives();
        const directives = db.prepare("SELECT * FROM directives WHERE type = 'OPTIMIZATION'").all() as any[];
        
        expect(directives.length).toBeGreaterThan(0);
        expect(directives[0].description).toContain('Swap VTIVX');
    });

    it('should physically convert a Tax Placement Issue into a PLACEMENT directive', async () => {
        // Setup a $50k position of REIT in TAXABLE (Inefficient)
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-tax', 'FIDELITY', 'TAXABLE')").run();
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-roth', 'FIDELITY', 'ROTH')").run();
        
        db.prepare(`INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, market_value, asset_type) 
                   VALUES (date('now'), 'acc-tax', 'O', 1000, 50000, 'EQUITY')`).run();
        
        db.prepare("INSERT INTO ticker_meta (ticker, name, yield) VALUES ('O', 'Realty Income', 0.05)").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type) VALUES ('O', 'O', '{\"REIT\":1}', 'EQUITY')").run();

        await generateDirectives();
        const directives = db.prepare("SELECT * FROM directives WHERE type = 'PLACEMENT'").all() as any[];
        
        expect(directives.length).toBeGreaterThan(0);
        expect(directives[0].description).toContain('O');
        expect(directives[0].reasoning).toContain('LEAKAGE');
    });
});
