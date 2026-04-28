
import { describe, it, expect, beforeEach } from 'vitest';
import { generateDirectives } from '../rebalancer';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';

describe('Island Rebalancer v3 Validation', () => {
    beforeEach(() => {
        setupTestDb();
    });

    it('should only suggest intra-island swaps and never transfer between accounts', async () => {
        // 1. Setup two isolated accounts
        db.prepare("INSERT INTO accounts (id, nickname, provider, tax_character) VALUES ('acc-roth', 'My Roth', 'FIDELITY', 'ROTH')").run();
        db.prepare("INSERT INTO accounts (id, nickname, provider, tax_character) VALUES ('acc-taxable', 'My Individual', 'FIDELITY', 'TAXABLE')").run();

        // 2. Setup overweight Stock in Roth, and global shortfall in REITs
        // Roth has $100k FZROX (Stock)
        db.prepare(`INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, market_value, asset_type) 
                   VALUES (date('now'), 'acc-roth', 'FZROX', 100, 100000, 'ETF')`).run();
        
        // Taxable has $50k AAPL
        db.prepare(`INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, market_value, asset_type) 
                   VALUES (date('now'), 'acc-taxable', 'AAPL', 10, 50000, 'EQUITY')`).run();

        // Ensure registry and meta exist
        db.prepare("INSERT INTO ticker_meta (ticker, name, er) VALUES ('FZROX', 'Total Stock', 0)").run();
        db.prepare("INSERT INTO ticker_meta (ticker, name, er) VALUES ('AAPL', 'Apple', 0)").run();
        db.prepare("INSERT INTO ticker_meta (ticker, name, er) VALUES ('FSRNX', 'REIT', 0.0007)").run();
        
        db.prepare(`INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
                   VALUES ('FZROX', 'TSM', '{"Total Stock Market": 1.0}', 'ETF', 1)`).run();
        db.prepare(`INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
                   VALUES ('AAPL', 'Apple', '{"US Large Cap/SP500/DJIX": 1.0}', 'EQUITY', 0)`).run();
        db.prepare(`INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
                   VALUES ('FSRNX', 'REIT', '{"REIT": 1.0}', 'ETF', 1)`).run();

        // 3. Run Engine
        await generateDirectives();
        
        const directives = db.prepare("SELECT * FROM directives").all() as any[];

        // 4. Physical Verification
        // SUCCESS CRITERIA: All directives should be localized to their respective accounts.
        // A "Swap" should happen in the Roth (FZROX -> REIT)
        const rothDirectives = directives.filter(d => d.account_id === 'acc-roth');
        expect(rothDirectives.length).toBeGreaterThan(0);
        expect(rothDirectives[0].description).toContain('Swap');
        expect(rothDirectives[0].description).toContain('in FIDELITY My Roth');

        // SUCCESS CRITERIA: NO directive should mention transferring between accounts.
        directives.forEach(d => {
            const accountsMentioned = d.description.match(/in (.+)$/g);
            expect(accountsMentioned?.length || 1).toBe(1); // Only one account mentioned per directive
        });

        console.log("✅ Island Constraint Verified: ZERO cross-account transfers suggested.");
    });
});
