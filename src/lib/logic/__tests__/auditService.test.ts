import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';
import { getAuditTrail } from '../auditService';

describe('auditService', () => {
    beforeEach(() => {
        setupTestDb();
        db.exec(`
            CREATE TABLE IF NOT EXISTS snapshots (
                date TEXT,
                ticker TEXT,
                asset_class TEXT,
                market_value REAL,
                account_id TEXT,
                asset_type TEXT,
                quantity REAL
            );
            DELETE FROM snapshots;
        `);
    });

    it('should aggregate historic snapshots by date for a given ticker, returning top 3 descending', () => {
        const stmt = db.prepare(`INSERT INTO snapshots (date, ticker, asset_class, market_value) VALUES (?, ?, ?, ?)`);
        stmt.run('2026-05-11', 'AAPL', 'US Equity', 100);
        stmt.run('2026-05-11', 'AAPL', 'US Equity', 50);
        stmt.run('2026-05-10', 'AAPL', 'US Equity', 140);
        stmt.run('2026-05-09', 'AAPL', 'US Equity', 130);
        stmt.run('2026-05-08', 'AAPL', 'US Equity', 120);
        stmt.run('2026-05-11', 'MSFT', 'US Equity', 200);

        const trail = getAuditTrail('AAPL');
        
        expect(trail).toHaveLength(3);
        expect(trail[0]).toEqual({ date: '2026-05-11', market_value: 150 });
        expect(trail[1]).toEqual({ date: '2026-05-10', market_value: 140 });
        expect(trail[2]).toEqual({ date: '2026-05-09', market_value: 130 });
    });

    it('should aggregate historic snapshots by date for a given asset class', () => {
        const stmt = db.prepare(`INSERT INTO snapshots (date, ticker, asset_class, market_value) VALUES (?, ?, ?, ?)`);
        stmt.run('2026-05-11', 'VTI', 'Total Stock', 500);
        stmt.run('2026-05-10', 'VTI', 'Total Stock', 450);
        stmt.run('2026-05-09', 'VTI', 'Total Stock', 400);
        stmt.run('2026-05-11', 'FZROX', 'Total Stock', 500);
        stmt.run('2026-05-10', 'FZROX', 'Total Stock', 450);

        const trail = getAuditTrail('Total Stock');
        
        expect(trail).toHaveLength(3);
        expect(trail[0]).toEqual({ date: '2026-05-11', market_value: 1000 });
        expect(trail[1]).toEqual({ date: '2026-05-10', market_value: 900 });
        expect(trail[2]).toEqual({ date: '2026-05-09', market_value: 400 });
    });
});
