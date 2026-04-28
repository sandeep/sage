// src/lib/logic/alpha/engine/__tests__/dailyPnl.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db/client';
import { runMigrations } from '@/lib/db/migrate';
import { aggregateDailyPnl } from '../dailyPnl';

describe('aggregateDailyPnl', () => {
    beforeEach(() => {
        runMigrations(db);
        // Clear tables
        db.prepare('DELETE FROM alpha_transactions').run();
        db.prepare('DELETE FROM alpha_option_trades').run();
        db.prepare('DELETE FROM alpha_equity_trades').run();
        db.prepare('DELETE FROM alpha_daily_pnl').run();
    });

    it('should aggregate P&L from various sources correctly', async () => {
        // 1. Insert some transactions
        db.prepare(`
            INSERT INTO alpha_transactions (source_file, activity_date, instrument, description, trans_code, amount, book)
            VALUES 
                ('test.csv', '2025-01-01', NULL, 'Futures Settlement', 'FUTSWP', 1000.0, 'FUTURES_CASH'),
                ('test.csv', '2025-01-01', NULL, 'Management Fee', 'GOLD', -10.0, 'FEE'),
                ('test.csv', '2025-01-01', NULL, 'Interest', 'INT', 5.0, 'INCOME'),
                ('test.csv', '2025-01-01', NULL, 'Deposit', 'ACH', 50000.0, 'DEPOSIT'),
                ('test.csv', '2025-01-02', NULL, 'Futures Settlement', 'FUTSWP', -200.0, 'FUTURES_CASH')
        `).run();

        // 2. Insert some closed trades
        db.prepare(`
            INSERT INTO alpha_option_trades (instrument, option_key, option_type, direction, open_date, open_code, open_qty, open_premium, close_date, close_code, close_qty, close_premium, net_pnl, outcome)
            VALUES 
                ('SPY', 'SPY 2025-01-02 CALL 600', 'CALL', 'SHORT', '2025-01-01', 'STO', 1, 500.0, '2025-01-02', 'BTC', 1, 300.0, 200.0, 'CLOSED')
        `).run();

        db.prepare(`
            INSERT INTO alpha_equity_trades (instrument, open_date, open_price, close_date, close_price, qty, net_pnl)
            VALUES 
                ('AAPL', '2025-01-01', 150.0, '2025-01-02', 155.0, 10, 50.0)
        `).run();

        // Run aggregation
        await aggregateDailyPnl();

        // Check results
        const rows = db.prepare('SELECT * FROM alpha_daily_pnl ORDER BY date').all() as any[];
        expect(rows).toHaveLength(2);

        // Date 2025-01-01:
        // Futures: 1000.0
        // Options: 0
        // Equity: 0
        // Fees: -10.0
        // Income: 5.0
        // Deposits: 50000.0
        // Daily Total: 1000 - 10 + 5 = 995.0
        // Cumulative: 995.0
        expect(rows[0]).toEqual(expect.objectContaining({
            date: '2025-01-01',
            futures_pnl: 1000.0,
            options_pnl: 0,
            equity_pnl: 0,
            fees: -10.0,
            income: 5.0,
            deposits: 50000.0,
            daily_total: 995.0,
            cumulative_pnl: 995.0
        }));

        // Date 2025-01-02:
        // Futures: -200.0
        // Options: 200.0
        // Equity: 50.0
        // Fees: 0
        // Income: 0
        // Deposits: 0
        // Daily Total: -200 + 200 + 50 = 50.0
        // Cumulative: 995 + 50 = 1045.0
        expect(rows[1]).toEqual(expect.objectContaining({
            date: '2025-01-02',
            futures_pnl: -200.0,
            options_pnl: 200.0,
            equity_pnl: 50.0,
            fees: 0,
            income: 0,
            deposits: 0,
            daily_total: 50.0,
            cumulative_pnl: 1045.0
        }));
    });
});
