import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';
import { getAuditTrail } from '../auditService';

describe('auditService', () => {
    beforeAll(() => {
        setupTestDb();
    });

    beforeEach(() => {
        db.exec("DELETE FROM holdings_ledger");
        db.exec("DELETE FROM asset_registry");
        db.exec("DELETE FROM accounts");
        
        db.exec("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'FIDELITY', 'TAXABLE')");
    });

    it('should aggregate historic snapshots by date for a given ticker, returning top 3 descending', () => {
        const stmt = db.prepare(`INSERT INTO holdings_ledger (snapshot_date, ticker, account_id, asset_type, market_value, quantity) VALUES (?, ?, ?, ?, ?, ?)`);
        stmt.run('2026-05-11', 'AAPL', 'acc1', 'EQUITY', 100, 1);
        stmt.run('2026-05-11', 'AAPL', 'acc1', 'EQUITY', 50, 0.5);
        stmt.run('2026-05-10', 'AAPL', 'acc1', 'EQUITY', 140, 1.4);
        stmt.run('2026-05-09', 'AAPL', 'acc1', 'EQUITY', 130, 1.3);
        stmt.run('2026-05-08', 'AAPL', 'acc1', 'EQUITY', 120, 1.2);
        stmt.run('2026-05-11', 'MSFT', 'acc1', 'EQUITY', 200, 2);

        const trail = getAuditTrail('AAPL');
        
        expect(trail).toHaveLength(3);
        expect(trail[0]).toEqual({ date: '2026-05-11', market_value: 150 });
        expect(trail[1]).toEqual({ date: '2026-05-10', market_value: 140 });
        expect(trail[2]).toEqual({ date: '2026-05-09', market_value: 130 });
    });

    it('should aggregate historic snapshots by date for a given asset class', () => {
        // Setup Asset Registry
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_class) VALUES (?, ?, ?, ?)").run('VTI', 'VTI', '{}', 'Total Stock');
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_class) VALUES (?, ?, ?, ?)").run('FZROX', 'FZROX', '{}', 'Total Stock');

        const stmt = db.prepare(`INSERT INTO holdings_ledger (snapshot_date, ticker, account_id, asset_type, market_value, quantity) VALUES (?, ?, ?, ?, ?, ?)`);
        stmt.run('2026-05-11', 'VTI',   'acc1', 'ETF', 500, 5);
        stmt.run('2026-05-10', 'VTI',   'acc1', 'ETF', 450, 4.5);
        stmt.run('2026-05-09', 'VTI',   'acc1', 'ETF', 400, 4);
        stmt.run('2026-05-11', 'FZROX', 'acc1', 'FUND', 500, 5);
        stmt.run('2026-05-10', 'FZROX', 'acc1', 'FUND', 450, 4.5);

        const trail = getAuditTrail('Total Stock');
        
        expect(trail).toHaveLength(3);
        expect(trail[0]).toEqual({ date: '2026-05-11', market_value: 1000 });
        expect(trail[1]).toEqual({ date: '2026-05-10', market_value: 900 });
        expect(trail[2]).toEqual({ date: '2026-05-09', market_value: 400 });
    });
});
