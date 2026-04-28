import { describe, it, expect, beforeEach, vi } from 'vitest';
import db from '@/lib/db/client';
import { runMigrations } from '@/lib/db/migrate';
import { calculateAlphaMetrics, getBookTradeStats } from '../metrics';

vi.mock('../benchmark', () => ({
    getVtiBenchmarkData: vi.fn().mockResolvedValue([])
}));

describe('Alpha Metrics Engine', () => {
    beforeEach(() => {
        runMigrations(db);
        db.prepare('DELETE FROM alpha_daily_pnl').run();
        db.prepare('DELETE FROM alpha_option_trades').run();
        db.prepare('DELETE FROM alpha_equity_trades').run();
        db.prepare('DELETE FROM alpha_transactions').run();
        db.prepare('DELETE FROM alpha_shadow_vti').run();
        db.prepare('DELETE FROM price_history').run();
    });

    it('should calculate basic metrics correctly', async () => {
        db.prepare(`
            INSERT INTO alpha_daily_pnl (date, daily_total, deposits, cumulative_pnl)
            VALUES 
                ('2025-01-01', 1000.0, 10000.0, 1000.0),
                ('2025-01-02', 500.0, 0.0, 1500.0)
        `).run();

        const metrics = await calculateAlphaMetrics();
        expect(metrics.totalPnl).toBe(1500.0);
        expect(metrics.totalDeposited).toBe(10000.0);
        expect(metrics.netReturnPct).toBe(0.15);
        expect(metrics.twr).toBeCloseTo(0.04545, 5);
        expect(metrics.maxDrawdown).toBe(0);
    });

    it('should handle drawdown correctly', async () => {
        db.prepare(`
            INSERT INTO alpha_daily_pnl (date, daily_total, deposits, cumulative_pnl)
            VALUES 
                ('2025-01-01', 0.0, 10000.0, 0.0),
                ('2025-01-02', -1000.0, 0.0, -1000.0),
                ('2025-01-03', 2000.0, 0.0, 1000.0)
        `).run();

        const metrics = await calculateAlphaMetrics();
        expect(metrics.maxDrawdown).toBe(0.1);
    });

    it('should calculate MWR, dollarAlpha, and shadowNav correctly', async () => {
        db.prepare(`
            INSERT INTO alpha_daily_pnl (date, daily_total, deposits, cumulative_pnl, nav)
            VALUES 
                ('2025-01-01', 0.0, 100.0, 0.0, 100.0),
                ('2026-01-01', 10.0, 0.0, 10.0, 110.0)
        `).run();

        db.prepare(`
            INSERT INTO alpha_shadow_vti (date, shares, price, value, cumulative_deposits)
            VALUES ('2026-01-01', 1.0, 105.0, 105.0, 100.0)
        `).run();

        const metrics = await calculateAlphaMetrics();
        expect(metrics.shadowNav).toBe(105.0);
        expect(metrics.dollarAlpha).toBe(110.0 - 105.0);
        expect(metrics.mwr).toBeGreaterThan(0.09);
        expect(metrics.mwr).toBeLessThan(0.11);
    });

    it('should compute book trade stats and benchmarkAlpha', async () => {
        db.prepare(`
            INSERT INTO price_history (ticker, date, close) VALUES 
            ('VTI', '2025-01-01', 200.0),
            ('VTI', '2025-01-11', 210.0)
        `).run();

        db.prepare(`
            INSERT INTO alpha_option_trades (instrument, option_key, option_type, direction, open_date, open_code, open_qty, open_premium, close_date, net_pnl, hold_days, strike)\n            VALUES \n                ('SPY', 'SPY 2025-01-02 CALL 600', 'CALL', 'SHORT', '2025-01-01', 'STO', 1, 500.0, '2025-01-11', 50.0, 10, 100)\n        `).run();

        db.prepare(`
            INSERT INTO alpha_equity_trades (instrument, open_date, close_date, open_price, qty, net_pnl)\n            VALUES \n                ('AAPL', '2025-01-01', '2025-01-11', 150.0, 10, 100.0)\n        `).run();

        const stats = await getBookTradeStats();
        
        const options = stats.find(s => s.book === 'Options');
        expect(options?.totalTrades).toBe(1);
        expect(options?.totalNetPnl).toBe(50.0);
        expect(options?.benchmarkAlpha).toBeCloseTo(50 - (10000 * 0.05 * 10 / 365), 2);

        const equities = stats.find(s => s.book === 'Equities');
        expect(equities?.totalTrades).toBe(1);
        expect(equities?.totalNetPnl).toBe(100.0);
        expect(equities?.benchmarkAlpha).toBeCloseTo(100 - (7.5 * 10), 2);
    });

    it('should compute bulletproof MWR and risk metrics for Equities and Options', async () => {
        // Equity trade: Buy at 100, Sell at 110 after 1 year. MWR should be ~10%
        db.prepare(`
            INSERT INTO alpha_equity_trades (instrument, open_date, close_date, open_price, qty, net_pnl, hold_days)
            VALUES ('EQ_TEST', '2024-01-01', '2025-01-01', 100.0, 10, 100.0, 365)
        `).run();

        // Option trade: STO for 500, BTC for 400 after 1 year. MWR should be related to premium/margin
        db.prepare(`
            INSERT INTO alpha_option_trades (instrument, option_key, option_type, direction, open_date, open_code, open_qty, open_premium, close_date, net_pnl, hold_days, strike)
            VALUES ('OPT_TEST', 'TEST CALL', 'CALL', 'SHORT', '2024-01-01', 'STO', 1, 500.0, '2025-01-01', 100.0, 365, 100)
        `).run();

        const stats = await getBookTradeStats();
        
        const eq = stats.find(s => s.book === 'Equities')!;
        expect(eq.mwr).toBeGreaterThan(0.09);
        expect(eq.mwr).toBeLessThan(0.11);
        
        const opt = stats.find(s => s.book === 'Options')!;
        // Options MWR is calculated on premium as cashflow
        // Open: -500 (premium received is positive cashflow, so we use negative for calculateMWR logic if we treat it as investment)
        // Wait, the user said: "For Options: Calculate MWR by treating open premium as cash flow."
        // If I receive $500 premium and end up with $600 ($100 profit), MWR should reflect that.
        expect(opt.mwr).toBeGreaterThan(0);
    });

    it('should compute refined Sharpe and Calmar metrics for all books', async () => {
        // Setup daily PNL for Calmar (drawdown)
        db.prepare(`
            INSERT INTO alpha_daily_pnl (date, futures_pnl, options_pnl, equity_pnl, daily_total, deposits)
            VALUES 
                ('2025-01-01', 100.0, 100.0, 100.0, 300.0, 0.0),
                ('2025-01-02', -50.0, -50.0, -50.0, -150.0, 0.0),
                ('2025-01-03', 200.0, 200.0, 200.0, 600.0, 0.0)
        `).run();

        // Setup transactions for Futures Volatility (FUTSWP)
        db.prepare(`
            INSERT INTO alpha_transactions (activity_date, trans_code, amount, book, source_file, instrument)
            VALUES 
                ('2025-01-01', 'FUTSWP', 100.0, 'FUTURES_CASH', 'test.csv', 'ES'),
                ('2025-01-02', 'FUTSWP', -50.0, 'FUTURES_CASH', 'test.csv', 'ES'),
                ('2025-01-03', 'FUTSWP', 200.0, 'FUTURES_CASH', 'test.csv', 'ES')
        `).run();

        // Setup Equity trade for Sharpe (returns) - need at least 2 for non-zero vol
        db.prepare(`
            INSERT INTO alpha_equity_trades (instrument, open_date, close_date, open_price, qty, net_pnl)
            VALUES 
                ('AAPL', '2025-01-01', '2025-01-03', 150.0, 10, 100.0),
                ('MSFT', '2025-01-01', '2025-01-03', 300.0, 5, -50.0)
        `).run();

        // Setup Option trade for Sharpe (returns) - need at least 2 for non-zero vol
        db.prepare(`
            INSERT INTO alpha_option_trades (instrument, option_key, option_type, direction, open_date, open_qty, open_premium, close_date, net_pnl, strike, open_code)
            VALUES 
                ('SPY', 'SPY CALL 1', 'CALL', 'SHORT', '2025-01-01', 1, 500.0, '2025-01-03', 50.0, 600, 'STO'),
                ('SPY', 'SPY CALL 2', 'CALL', 'SHORT', '2025-01-01', 1, 400.0, '2025-01-03', -20.0, 590, 'STO')
        `).run();

        const stats = await getBookTradeStats();

        for (const book of ['Options', 'Equities', 'Futures']) {
            const s = stats.find(b => b.book === book)!;
            expect(s.sharpeRatio).not.toBe(0);
            expect(s.calmarRatio).not.toBe(0);
        }
    });
});
