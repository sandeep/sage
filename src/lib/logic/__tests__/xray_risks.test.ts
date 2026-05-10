
import { describe, it, expect, beforeEach } from 'vitest';
import { getExpenseRisks } from '../xray_risks';
import db from '../../db/client';
import { setupTestDb } from '../../../lib/db/__tests__/setup';

describe('getExpenseRisks', () => {
    beforeEach(() => {
        setupTestDb();
        
        // Setup metadata for tickers
        db.prepare("INSERT INTO ticker_meta (ticker, er, name) VALUES ('VTIVX', 0.0008, 'Vanguard Target 2045')").run();
        db.prepare("INSERT INTO ticker_meta (ticker, er, name) VALUES ('FZROX', 0.0000, 'Fidelity Zero Total Market')").run();
        
        // Setup asset registry with weights so they are in the same category
        const weights = JSON.parse(JSON.stringify({ "US_STOCK": 1.0 }));
        db.prepare("INSERT INTO asset_registry (ticker, weights, asset_type, canonical) VALUES ('VTIVX', ?, 'FUND', 'VTIVX')").run(JSON.stringify(weights));
        db.prepare("INSERT INTO asset_registry (ticker, weights, asset_type, canonical) VALUES ('FZROX', ?, 'FUND', 'FZROX')").run(JSON.stringify(weights));
    });

    it('returns account-aware expense risks', () => {
        // Setup two accounts
        db.prepare("INSERT INTO accounts (id, nickname, provider, tax_character) VALUES ('acc1', 'Vanguard 401k', 'VANGUARD', 'DEFERRED')").run();
        db.prepare("INSERT INTO accounts (id, nickname, provider, tax_character) VALUES ('acc2', 'Fidelity IRA', 'FIDELITY', 'DEFERRED')").run();
        
        // Insert holdings for the SAME ticker in DIFFERENT accounts
        // We use holdings_ledger because getHoldings() queries it
        const today = new Date().toISOString().split('T')[0];
        db.prepare("INSERT INTO holdings_ledger (account_id, ticker, quantity, market_value, snapshot_date, asset_type) VALUES ('acc1', 'VTIVX', 1000, 100000, ?, 'FUND')").run(today);
        db.prepare("INSERT INTO holdings_ledger (account_id, ticker, quantity, market_value, snapshot_date, asset_type) VALUES ('acc2', 'VTIVX', 500, 50000, ?, 'FUND')").run(today);

        const risks = getExpenseRisks();
        
        // Expect TWO separate risk entries, one for each account
        expect(risks).toHaveLength(2);
        
        const risk1 = risks.find(r => r.accountId === 'acc1');
        const risk2 = risks.find(r => r.accountId === 'acc2');
        
        expect(risk1).toBeDefined();
        expect(risk1?.accountName).toBe('Vanguard 401k');
        expect(risk1?.currentTicker).toBe('VTIVX');
        expect(risk1?.potentialSavings).toBeGreaterThan(0);

        expect(risk2).toBeDefined();
        expect(risk2?.accountName).toBe('Fidelity IRA');
        expect(risk2?.currentTicker).toBe('VTIVX');
        expect(risk2?.potentialSavings).toBeGreaterThan(0);
    });
});
