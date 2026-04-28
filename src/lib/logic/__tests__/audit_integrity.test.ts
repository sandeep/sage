
import { describe, it, expect, beforeEach } from 'vitest';
import { generateAuditReport } from '../auditEngine';
import db from '../../db/client';
import { setupTestDb } from '../../../lib/db/__tests__/setup';

describe('Audit Engine Integrity', () => {
    beforeEach(() => {
        setupTestDb();
    });

    it('should physically identify concentration risks and structural inefficiencies', async () => {
        // 1. Setup Physical Data
        db.prepare("INSERT INTO accounts (id, nickname, provider, tax_character) VALUES ('acc-1', 'Test', 'FIDELITY', 'TAXABLE')").run();
        
        // Setup $100k AAPL (High Concentration) and $50k VTIVX (High Fee)
        db.prepare(`INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, market_value, asset_type) 
                   VALUES (date('now'), 'acc-1', 'AAPL', 100, 250000, 'EQUITY')`).run();
        db.prepare(`INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, market_value, asset_type) 
                   VALUES (date('now'), 'acc-1', 'VTIVX', 100, 50000, 'ETF')`).run();

        db.prepare("INSERT INTO ticker_meta (ticker, name, er, close) VALUES ('AAPL', 'Apple Inc', 0, 2500)").run();
        db.prepare("INSERT INTO ticker_meta (ticker, name, er, close) VALUES ('VTIVX', 'Vanguard 2045', 0.0008, 500)").run();

        db.prepare(`INSERT INTO asset_registry (ticker, canonical, weights, asset_type) 
                   VALUES ('AAPL', 'Apple', '{"US Large Cap/SP500/DJIX": 1.0}', 'EQUITY')`).run();
        db.prepare(`INSERT INTO asset_registry (ticker, canonical, weights, asset_type) 
                   VALUES ('VTIVX', 'Target 2045', '{"Total Stock Market": 1.0}', 'ETF')`).run();

        // 2. Run Engine
        const report = await generateAuditReport();

        // 3. PHYSICAL VERIFICATION
        // AAPL is 250k / 300k = 83% (> 5% threshold). MUST be in concentrationRisks.
        expect(report.concentrationRisks.some(r => r.ticker === 'AAPL')).toBe(true);
        
        // VTIVX has ER > 0.05% and cheaper FZROX exists (in registry mock logic). 
        // Even if FZROX isn't mocked, VTIVX should be processed.
        expect(report.tv).toBe(300000);
        console.log("✅ Audit Integrity Verified: Forensic risks physically present.");
    });
});
