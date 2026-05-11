
import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';
import { generateDirectives } from '../rebalancer';

describe('Execution Desk E2E Verification', () => {
    beforeEach(() => {
        setupTestDb();
    });

    it('executes a complete rebalance flow with ticker resolution and tranches', async () => {
        // 1. SEED ACCOUNTS
        db.prepare("INSERT INTO accounts (id, nickname, provider, tax_character) VALUES ('acc-van-tax', 'Brokerage', 'VANGUARD', 'TAXABLE')").run();
        db.prepare("INSERT INTO accounts (id, nickname, provider, tax_character) VALUES ('acc-fid-roth', 'Roth', 'FIDELITY', 'ROTH')").run();

        // 2. SEED HOLDINGS
        // Vanguard has $100k VTIVX (Expensive)
        db.prepare(`INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, market_value, asset_type) 
                   VALUES (date('now'), 'acc-van-tax', 'VTIVX', 1000, 100000, 'FUND')`).run();
        
        // Fidelity has $50k Cash
        db.prepare(`INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, market_value, asset_type) 
                   VALUES (date('now'), 'acc-fid-roth', 'CASH', 50000, 50000, 'CASH')`).run();

        // 3. SEED REGISTRY & META
        // VTIVX is expensive (0.08%), VIIIX is cheap (0.02%)
        db.prepare("INSERT INTO ticker_meta (ticker, name, er) VALUES ('VTIVX', 'Vanguard Target 2045', 0.0008)").run();
        db.prepare("INSERT INTO ticker_meta (ticker, name, er) VALUES ('VIIIX', 'Vanguard Institutional', 0.0002)").run();
        db.prepare("INSERT INTO ticker_meta (ticker, name, er) VALUES ('FZROX', 'Fidelity Zero Total Market', 0.0000)").run();
        db.prepare("INSERT INTO ticker_meta (ticker, name, er) VALUES ('CASH', 'Cash', 0.0)").run();

        db.prepare(`INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
                   VALUES ('VTIVX', 'Total Stock Market', '{"Total Stock Market":1.0}', 'FUND', 1)`).run();
        db.prepare(`INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
                   VALUES ('VIIIX', 'Total Stock Market', '{"Total Stock Market":1.0}', 'FUND', 1)`).run();
        db.prepare(`INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
                   VALUES ('FZROX', 'Total Stock Market', '{"Total Stock Market":1.0}', 'FUND', 1)`).run();

        // 4. SEED STRATEGY (100% Total Stock Market)
        db.prepare("DELETE FROM allocation_nodes").run();
        db.prepare("INSERT INTO allocation_nodes (label, parent_label, weight, level) VALUES ('Portfolio', null, 1.0, 0)").run();
        db.prepare("INSERT INTO allocation_nodes (label, parent_label, weight, level) VALUES ('Total Stock Market', 'Portfolio', 1.0, 1)").run();

        // 5. EXECUTE ENGINE
        const count = await generateDirectives();
        expect(count).toBeGreaterThan(0);

        const directives = db.prepare("SELECT * FROM directives ORDER BY amount DESC").all() as any[];

        // VERIFY: Expensive fund swap (OPTIMIZATION)
        // VTIVX in Vanguard should be swapped for VIIIX
        const optimization = directives.find(d => d.type === 'OPTIMIZATION' && d.source_ticker === 'VTIVX');
        expect(optimization).toBeDefined();
        expect(optimization.target_ticker).toBe('VIIIX');
        expect(optimization.amount).toBe(100000); // Full value

        // VERIFY: Fidelity Ticker Resolution (FZROX)
        // Cash in Fidelity should buy FZROX
        const fidelityBuy = directives.find(d => d.account_id === 'acc-fid-roth' && d.type === 'REBALANCE');
        expect(fidelityBuy).toBeDefined();
        expect(fidelityBuy.target_ticker).toBe('FZROX');
        expect(fidelityBuy.source_ticker).toBe('CASH');

        // VERIFY: Tranching (> $20k)
        // $100k optimization should be split into 5 tranches of $20k
        const vanTranches = directives.filter(d => d.account_id === 'acc-van-tax' && d.source_ticker === 'VTIVX');
        expect(vanTranches.length).toBe(5);
        expect(vanTranches[0].amount).toBe(20000);
        expect(vanTranches[0].tranche_total).toBe(5);

        // $50k Fidelity buy should be split into 3 tranches (~$16.6k)
        const fidTranches = directives.filter(d => d.account_id === 'acc-fid-roth' && d.target_ticker === 'FZROX');
        expect(fidTranches.length).toBe(3);
        expect(fidTranches[0].tranche_total).toBe(3);

        // VERIFY: Structured Data
        directives.forEach(d => {
            expect(d.account_id).toBeDefined();
            expect(d.source_ticker).toBeDefined();
            expect(d.target_ticker).toBeDefined();
        });
    });
});
