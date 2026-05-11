
import { describe, it, expect, beforeEach } from 'vitest';
import { generateDirectives } from '../rebalancer';
import { applyWashSaleGuard } from '../rebalance/washSaleGuard';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';

describe('Task 1: Structured Data Evolution', () => {
    beforeEach(() => {
        setupTestDb();
    });

    it('directives table should have source_ticker and target_ticker columns', () => {
        const cols = (db.prepare('PRAGMA table_info(directives)').all() as any[]).map(c => c.name);
        expect(cols).toContain('source_ticker');
        expect(cols).toContain('target_ticker');
    });

    it('generated directives should populate source_ticker and target_ticker', async () => {
        // ... (rest of the test)
        // Setup two isolated accounts
        db.prepare("INSERT INTO accounts (id, nickname, provider, tax_character) VALUES ('acc-roth', 'My Roth', 'FIDELITY', 'ROTH')").run();

        // Roth has $100k FZROX (Stock)
        db.prepare(`INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, market_value, asset_type) 
                   VALUES (date('now'), 'acc-roth', 'FZROX', 100, 100000, 'ETF')`).run();

        // Ensure registry and meta exist
        db.prepare("INSERT INTO ticker_meta (ticker, name, er) VALUES ('FZROX', 'Total Stock', 0)").run();
        db.prepare("INSERT INTO ticker_meta (ticker, name, er) VALUES ('FSRNX', 'REIT', 0.0007)").run();
        
        db.prepare(`INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
                   VALUES ('FZROX', 'TSM', '{"Total Stock Market":1}', 'ETF', 1)`).run();
        db.prepare(`INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
                   VALUES ('FSRNX', 'REIT', '{"REIT":1}', 'ETF', 1)`).run();

        // Setup a strategy that forces a rebalance out of Stock into REIT
        db.prepare("DELETE FROM allocation_nodes").run();
        db.prepare("INSERT INTO allocation_nodes (label, parent_label, weight, level) VALUES ('Stock', null, 1.0, 0)").run();
        db.prepare("INSERT INTO allocation_nodes (label, parent_label, weight, level) VALUES ('Domestic', 'Stock', 1.0, 1)").run();
        db.prepare("INSERT INTO allocation_nodes (label, parent_label, weight, level) VALUES ('Total Stock Market', 'Domestic', 0.5, 2)").run();
        db.prepare("INSERT INTO allocation_nodes (label, parent_label, weight, level) VALUES ('REIT', 'Domestic', 0.5, 2)").run();

        // Run Engine
        await generateDirectives();
        
        const directives = db.prepare("SELECT * FROM directives").all() as any[];

        // We expect at least one REBALANCE directive swapping FZROX for FSRNX
        const swap = directives.find(d => d.type === 'REBALANCE' || d.type === 'SELL');
        expect(swap).toBeDefined();
        expect(swap.source_ticker).toBe('FZROX');
        expect(swap.target_ticker).toBe('FSRNX');
        expect(swap.amount).toBeGreaterThan(0);
    });

    it('applyWashSaleGuard should use target_ticker for lockouts', () => {
        // Mock a lockout for FSRNX
        db.prepare("INSERT INTO wash_sale_lockouts (ticker, locked_until) VALUES ('FSRNX', datetime('now', '+30 days'))").run();
        
        // Ensure a proxy exists for FSRNX
        db.prepare(`INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
                   VALUES ('FSRNX', 'REIT_PROXY', '{"REIT":1}', 'ETF', 1)`).run();

        const directives: any[] = [{
            type: 'REBALANCE',
            description: 'Swap FZROX to FSRNX',
            target_ticker: 'FSRNX',
            source_ticker: 'FZROX',
            reasoning: 'Testing wash sale'
        }];

        const guarded = applyWashSaleGuard(directives);
        
        expect(guarded[0].target_ticker).toBe('REIT_PROXY');
        expect(guarded[0].description).toContain('REIT_PROXY [WASH SALE PROXY]');
    });
});
