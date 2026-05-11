import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../../db/client';
import { setupTestDb } from '../../../db/__tests__/setup';
import { mapIslands } from '../islandEngine';

describe('islandEngine - mapIslands', () => {
    beforeEach(() => {
        setupTestDb();
    });

    it('Step 1: shortfall targetTicker should use Tier D (already held) from resolveInstrument', () => {
        // 1. Setup account and holding
        db.prepare("INSERT INTO accounts (id, provider, nickname, tax_character) VALUES ('acc-1', 'VANGUARD', 'Brokerage', 'TAXABLE')").run();
        
        // This is a core fund for Vanguard but we want to see if it's picked because it's HELD.
        // Actually, let's use a NON-standard fund for the asset class.
        // Asset Class: "Total Stock Market". Vanguard standard is "VIIIX".
        // We will hold "VTI" and see if it picks "VTI" instead of "VIIIX".
        
        db.prepare(`
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
            VALUES ('VTI', 'Vanguard Total Stock Market', '{"Total Stock Market":1.0}', 'ETF', 0)
        `).run();

        db.prepare(`
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
            VALUES ('VIIIX', 'Vanguard Institutional Index', '{"Total Stock Market":1.0}', 'FUND', 1)
        `).run();
        
        // Account holds VTI
        db.prepare(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value) 
            VALUES ('2026-01-01', 'acc-1', 'VTI', 10, 'ETF', 2500)
        `).run();

        // Add a large holding in another asset class to create a general shortfall in "Total Stock Market"
        db.prepare(`
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
            VALUES ('VOO', 'S&P 500', '{"US Large Cap/SP500/DJIX":1.0}', 'ETF', 1)
        `).run();
        db.prepare(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value) 
            VALUES ('2026-01-01', 'acc-1', 'VOO', 1000, 'ETF', 100000)
        `).run();

        const islands = mapIslands();
        const island = islands.find(i => i.accountId === 'acc-1');
        const shortfall = island?.shortfall.find(s => s.assetClass === 'Total Stock Market');
        
        // VERIFY: Should be 'VTI' (Tier D) not 'VIIIX' (Tier B)
        // Currently, resolveTickerForCategory might pick VIIIX because it's a "FUND" and matches "Vanguard".
        expect(shortfall?.targetTicker).toBe('VTI');
    });

    it('Step 3: mapIslands should decompose multi-asset funds into constituent categories', () => {
        // Setup: A fund that is 40% Bond (UNDERWEIGHT), 60% Stock (OVERWEIGHT)
        // We put Bond first so current logic only sees the underweight part.
        db.prepare("INSERT INTO accounts (id, provider, nickname, tax_character) VALUES ('acc-2', 'SCHWAB', 'Trust', 'TAXABLE')").run();
        
        db.prepare(`
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
            VALUES ('VBIAX', 'Balanced Fund', '{"US Aggregate Bond":0.4, "US Large Cap/SP500/DJIX":0.6}', 'FUND', 1)
        `).run();

        // Total Portfolio = 100,000
        // Expected US Large Cap approx 13.3% -> 13.3k
        // Expected Bond 2% -> 2k
        
        // Let's make Bond UNDERWEIGHT by increasing its target weight temporarily? 
        // No, let's just make the actuals small.
        
        // Actuals:
        // Hold 50k of SPY (US Large Cap) -> total US Large Cap = 50k + 0.6*10k = 56k (OVERWEIGHT)
        // Hold 10k of VBIAX 
        // Total Portfolio = 60k
        // Expected US Large Cap = 60k * 0.133 = 8k. (Actual 56k is OVERWEIGHT)
        // Expected Bond = 60k * 0.02 = 1.2k. 
        // Actual Bond = 0.4 * 10k = 4k. (Wait, it's also overweight).
        
        // I need Bond to be UNDERWEIGHT.
        // Let's change the user settings or just use a very high expected weight for Bond.
        db.prepare("UPDATE allocation_nodes SET weight = 0.5 WHERE label = 'US Aggregate Bond'").run();
        // Now Expected Bond = 60k * 0.5 = 30k.
        // Actual Bond = 4k. UNDERWEIGHT.
        
        db.prepare(`
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
            VALUES ('SPY', 'S&P 500', '{"US Large Cap/SP500/DJIX":1.0}', 'ETF', 1)
        `).run();
        
        db.prepare(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value) 
            VALUES ('2026-01-01', 'acc-2', 'SPY', 500, 'ETF', 50000)
        `).run();

        db.prepare(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value) 
            VALUES ('2026-01-01', 'acc-2', 'VBIAX', 100, 'FUND', 10000)
        `).run();

        const islands = mapIslands();
        const island = islands.find(i => i.accountId === 'acc-2');
        
        // VBIAX should be identified as "Excess" because of its US Large Cap component (which is overweight)
        // Current logic only looks at "US Aggregate Bond" (which is underweight) and will SKIP it.
        const excessVbiax = island?.excess.find(e => e.ticker === 'VBIAX');
        expect(excessVbiax).toBeDefined();
    });

    it('Step 4: mapIslands should NOT mark a fund as Excess if shortfall outweighs overweight (Net Effect)', () => {
        // Setup: A fund that is 50% US Large Cap (OVERWEIGHT), 50% US Aggregate Bond (SEVERE SHORTFALL)
        db.prepare("INSERT INTO accounts (id, provider, nickname, tax_character) VALUES ('acc-net-1', 'SCHWAB', 'IRA', 'ROTH')").run();
        
        db.prepare(`
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
            VALUES ('NET_FUND', 'Net Fund', '{"US Aggregate Bond":0.5, "US Large Cap/SP500/DJIX":0.5}', 'FUND', 1)
        `).run();

        // Update targets to make Bond a high priority
        db.prepare("UPDATE allocation_nodes SET weight = 0.8 WHERE label = 'US Aggregate Bond'").run(); 
        db.prepare("UPDATE allocation_nodes SET weight = 0.1 WHERE label = 'US Large Cap/SP500/DJIX'").run(); 

        // Hold some pure stock to create overweight
        db.prepare(`
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) 
            VALUES ('PURE_STOCK', 'Pure Stock', '{"US Large Cap/SP500/DJIX":1.0}', 'ETF', 1)
        `).run();
        db.prepare(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value) 
            VALUES ('2026-01-01', 'acc-net-1', 'PURE_STOCK', 1000, 'ETF', 40000)
        `).run();

        // Hold the multi-asset fund
        db.prepare(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value) 
            VALUES ('2026-01-01', 'acc-net-1', 'NET_FUND', 100, 'FUND', 10000)
        `).run();

        // Total Portfolio = 40k + 10k = 50k.
        // US Large Cap actual = 40k + 0.5*10k = 45k.
        // US Aggregate Bond actual = 0.5*10k = 5k.
        
        // Expected US Large Cap = 50k * 0.1 = 5k. Delta = 45k - 5k = +40k.
        // Expected US Aggregate Bond = 50k * 0.8 = 40k. Delta = 5k - 40k = -35k.
        
        // Net Delta of NET_FUND = 0.5 * (+40k) + 0.5 * (-35k) = 20k - 17.5k = 2.5k.
        // Still positive, but let's make it negative.
        
        db.prepare("UPDATE allocation_nodes SET weight = 0.9 WHERE label = 'US Aggregate Bond'").run();
        // Total Portfolio = 50k.
        // Expected US Aggregate Bond = 50k * 0.9 = 45k.
        // US Aggregate Bond Delta = 5k - 45k = -40k.
        
        // Net Delta of NET_FUND = 0.5 * (+40k) + 0.5 * (-40k) = 0.
        // 0 <= 500, so it should NOT be excess.
        
        const islands = mapIslands();
        const island = islands.find(i => i.accountId === 'acc-net-1');
        const excessNetFund = island?.excess.find(e => e.ticker === 'NET_FUND');
        expect(excessNetFund).toBeUndefined();
    });
});
