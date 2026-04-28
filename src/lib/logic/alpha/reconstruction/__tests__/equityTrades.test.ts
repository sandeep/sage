import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db/client';
import { runMigrations } from '@/lib/db/migrate';
import { setupTestDb } from '@/lib/db/__tests__/setup';
import { reconstructEquityTrades } from '../equityTrades';

describe('equityTrades reconstruction', () => {
    beforeEach(() => {
        setupTestDb();
        runMigrations(db);
        db.prepare('DELETE FROM alpha_transactions').run();
        db.prepare('DELETE FROM alpha_equity_trades').run();
    });

    it('should reconstruct a simple LONG equity round trip', async () => {
        const instrument = 'HOOD';

        // Buy 10 @ 15
        db.prepare(`
            INSERT INTO alpha_transactions (source_file, activity_date, instrument, trans_code, quantity, price, amount, book)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('test.csv', '2026-01-01', instrument, 'Buy', 10, 15, -150, 'EQUITY');

        // Sell 10 @ 20
        db.prepare(`
            INSERT INTO alpha_transactions (source_file, activity_date, instrument, trans_code, quantity, price, amount, book)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('test.csv', '2026-01-05', instrument, 'Sell', -10, 20, 200, 'EQUITY');

        const count = await reconstructEquityTrades();

        expect(count).toBe(1);
        const trades = db.prepare('SELECT * FROM alpha_equity_trades').all() as any[];
        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({
            instrument,
            open_date: '2026-01-01',
            open_price: 15,
            close_date: '2026-01-05',
            close_price: 20,
            qty: 10,
            net_pnl: (20 - 15) * 10, // 50
            hold_days: 4
        });
    });

    it('should handle partial fills and multiple buys', async () => {
        const instrument = 'AAPL';

        // Buy 5 @ 150
        db.prepare(`INSERT INTO alpha_transactions (source_file, activity_date, instrument, trans_code, quantity, price, amount, book) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('test.csv', '2026-01-01', instrument, 'Buy', 5, 150, -750, 'EQUITY');
        // Buy 5 @ 160
        db.prepare(`INSERT INTO alpha_transactions (source_file, activity_date, instrument, trans_code, quantity, price, amount, book) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('test.csv', '2026-01-02', instrument, 'Buy', 5, 160, -800, 'EQUITY');
        // Sell 7 @ 170
        db.prepare(`INSERT INTO alpha_transactions (source_file, activity_date, instrument, trans_code, quantity, price, amount, book) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('test.csv', '2026-01-03', instrument, 'Sell', -7, 170, 1190, 'EQUITY');

        await reconstructEquityTrades();

        const trades = db.prepare('SELECT * FROM alpha_equity_trades').all() as any[];
        expect(trades).toHaveLength(2); // FIFO: 5 from first buy, 2 from second buy
        
        expect(trades[0]).toMatchObject({ qty: 5, open_price: 150, close_price: 170 });
        expect(trades[1]).toMatchObject({ qty: 2, open_price: 160, close_price: 170 });
    });
});
