import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import db from '@/lib/db/client';
import { runMigrations } from '@/lib/db/migrate';
import { reconstructShadowVti } from '../shadowPortfolio';

describe('Shadow VTI Engine', () => {
    beforeAll(() => {
        runMigrations(db);
    });

    beforeEach(() => {
        db.prepare('DELETE FROM alpha_transactions').run();
        db.prepare('DELETE FROM price_history').run();
        db.prepare('DELETE FROM alpha_shadow_vti').run();
    });

    it('should calculate daily VTI shares and value based on deposits', async () => {
        // 1. Setup VTI price history
        const insertPrice = db.prepare('INSERT INTO price_history (ticker, date, close) VALUES (?, ?, ?)');
        insertPrice.run('VTI', '2026-01-01', 200);
        insertPrice.run('VTI', '2026-01-02', 205);
        insertPrice.run('VTI', '2026-01-03', 210);

        // 2. Setup Alpha deposits
        // Deposit $1000 on 2026-01-01 -> 5 shares
        // Deposit $1025 on 2026-01-02 -> 5 shares (total 10)
        const insertTrans = db.prepare(`
            INSERT INTO alpha_transactions (source_file, activity_date, trans_code, amount, book)
            VALUES (?, ?, ?, ?, ?)
        `);
        insertTrans.run('test.csv', '2026-01-01', 'DEP', 1000, 'DEPOSIT');
        insertTrans.run('test.csv', '2026-01-02', 'DEP', 1025, 'DEPOSIT');

        // We'll pass a fixed "today" to make it deterministic
        await reconstructShadowVti('2026-01-03');

        const results = db.prepare('SELECT * FROM alpha_shadow_vti ORDER BY date ASC').all() as any[];

        expect(results).toHaveLength(3);
        
        // 2026-01-01
        expect(results[0]).toEqual(expect.objectContaining({
            date: '2026-01-01',
            shares: 5,
            price: 200,
            value: 1000,
            cumulative_deposits: 1000
        }));

        // 2026-01-02
        expect(results[1]).toEqual(expect.objectContaining({
            date: '2026-01-02',
            shares: 10,
            price: 205,
            value: 2050,
            cumulative_deposits: 2025
        }));

        // 2026-01-03
        expect(results[2]).toEqual(expect.objectContaining({
            date: '2026-01-03',
            shares: 10,
            price: 210,
            value: 2100,
            cumulative_deposits: 2025
        }));
    });

    it('should fallback to nearest prior price if VTI price is missing', async () => {
         // Setup VTI price history with a gap
        const insertPrice = db.prepare('INSERT INTO price_history (ticker, date, close) VALUES (?, ?, ?)');
        insertPrice.run('VTI', '2026-01-01', 200);
        // Gap on 01-02
        insertPrice.run('VTI', '2026-01-03', 210);

        db.prepare(`
            INSERT INTO alpha_transactions (source_file, activity_date, trans_code, amount, book)
            VALUES ('test.csv', '2026-01-01', 'DEP', 1000, 'DEPOSIT')
        `).run();

        await reconstructShadowVti('2026-01-03');

        const results = db.prepare('SELECT * FROM alpha_shadow_vti ORDER BY date ASC').all() as any[];

        expect(results).toHaveLength(3);
        
        const jan2 = results.find(r => r.date === '2026-01-02');
        expect(jan2.price).toBe(200); // Fallback to Jan 1 price
        expect(jan2.shares).toBe(5);
        expect(jan2.value).toBe(1000);
    });

    it('should use a price from BEFORE the first transaction if missing on start date', async () => {
        // Price on 2025-12-31
        db.prepare('INSERT INTO price_history (ticker, date, close) VALUES (?, ?, ?)').run('VTI', '2025-12-31', 100);
        
        // Transaction on 2026-01-01 (no price on this date)
        db.prepare(`
            INSERT INTO alpha_transactions (source_file, activity_date, trans_code, amount, book)
            VALUES ('test.csv', '2026-01-01', 'DEP', 1000, 'DEPOSIT')
        `).run();

        await reconstructShadowVti('2026-01-01');

        const results = db.prepare('SELECT * FROM alpha_shadow_vti ORDER BY date ASC').all() as any[];

        expect(results).toHaveLength(1);
        expect(results[0].date).toBe('2026-01-01');
        expect(results[0].price).toBe(100);
        expect(results[0].shares).toBe(10); // 1000 / 100
        expect(results[0].value).toBe(1000);
    });

    it('should handle withdrawals correctly', async () => {
        const insertPrice = db.prepare('INSERT INTO price_history (ticker, date, close) VALUES (?, ?, ?)');
        insertPrice.run('VTI', '2026-01-01', 200);
        insertPrice.run('VTI', '2026-01-02', 200);

        const insertTrans = db.prepare(`
            INSERT INTO alpha_transactions (source_file, activity_date, trans_code, amount, book)
            VALUES (?, ?, ?, ?, ?)
        `);
        insertTrans.run('test.csv', '2026-01-01', 'DEP', 1000, 'DEPOSIT'); // 5 shares
        insertTrans.run('test.csv', '2026-01-02', 'WITH', -400, 'WITHDRAWAL'); // -2 shares

        await reconstructShadowVti('2026-01-02');

        const results = db.prepare('SELECT * FROM alpha_shadow_vti ORDER BY date ASC').all() as any[];

        expect(results[1]).toEqual(expect.objectContaining({
            date: '2026-01-02',
            shares: 3,
            value: 600,
            cumulative_deposits: 600
        }));
    });
});
