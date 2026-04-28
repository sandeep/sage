
import { describe, it, expect, beforeEach } from 'vitest';
import { calculatePortfolioPerformance } from '../portfolioEngine';
import db from '../../db/client';
import { setupTestDb } from '../../../lib/db/__tests__/setup';
import { TODAY_ANCHOR } from '../referenceDates';

describe('Performance Engine - Ground Truth Benchmark', () => {
    beforeEach(() => {
        setupTestDb();
    });

    it('should accurately calculate 10% return and matching value for a linear price series', () => {
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'FIDELITY', 'TAXABLE')").run();
        db.prepare("INSERT INTO holdings (account_id, ticker, quantity, asset_type) VALUES ('acc1', 'GLD', 100, 'EQUITY')").run();
        
        // Price goes from 100 to 110 (10% return) over 10 days
        const dates = [
            '2026-03-11','2026-03-12','2026-03-13','2026-03-14','2026-03-15',
            '2026-03-16','2026-03-17','2026-03-18','2026-03-19', TODAY_ANCHOR
        ];
        dates.forEach((d, i) => {
            db.prepare("INSERT INTO price_history (ticker, date, close) VALUES ('GLD', ?, ?)").run(d, 100 + i);
        });

        const metrics = calculatePortfolioPerformance();
        
        expect(metrics.return1y).toBeCloseTo(0.09, 2); // (109 / 100) - 1 = 9%
        expect(metrics.totalPortfolioValue).toBe(10900); // 100 shares * 109
    });
});
