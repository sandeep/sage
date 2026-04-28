import { describe, it, expect, beforeEach, vi } from 'vitest';
import db from '../../../../db/client';
import { setupTestDb } from '../../../../db/__tests__/setup';
import { getMissingAlphaTickers, syncAlphaPriceHistory } from '../priceSync';
import * as priceRefresh from '../../../../data/priceRefresh';

vi.mock('../../../../data/priceRefresh', async () => {
    const actual = await vi.importActual('../../../../data/priceRefresh') as any;
    return {
        ...actual,
        yfHistoricalPrices: vi.fn(),
        sleep: vi.fn().mockResolvedValue(undefined),
    };
});

describe('Alpha Price Sync', () => {
    beforeEach(() => {
        setupTestDb();
        vi.clearAllMocks();
    });

    it('should identify tickers from alpha_equity_trades and alpha_option_trades missing in price_history', () => {
        // Seed some trades
        db.prepare(`
            INSERT INTO alpha_equity_trades (instrument, open_date, open_price, qty)
            VALUES (?, ?, ?, ?)
        `).run('TSLA', '2024-01-01', 200, 10);

        db.prepare(`
            INSERT INTO alpha_option_trades (instrument, option_key, option_type, direction, open_date, open_code, open_qty, open_premium)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('META', 'META 240621C00500000', 'CALL', 'LONG', '2024-01-01', 'O', 1, 50);

        // Seed some existing price history for one of them
        db.prepare(`
            INSERT INTO price_history (ticker, date, close)
            VALUES (?, ?, ?)
        `).run('TSLA', '2024-01-01', 200);

        const missing = getMissingAlphaTickers();
        
        expect(missing).toContain('META');
        expect(missing).not.toContain('TSLA');
    });

    it('should sync missing alpha prices and populate price_history', async () => {
        // Seed a missing ticker in trades
        db.prepare(`
            INSERT INTO alpha_equity_trades (instrument, open_date, open_price, qty)
            VALUES (?, ?, ?, ?)
        `).run('AAPL', '2024-01-01', 150, 10);

        // Mock historical prices return
        const mockPrices = [
            { date: '2024-01-01', close: 150.5 },
            { date: '2024-01-02', close: 152.0 }
        ];
        vi.mocked(priceRefresh.yfHistoricalPrices).mockResolvedValue(mockPrices);

        await syncAlphaPriceHistory();

        // Verify price_history population
        const AAPLPrices = db.prepare("SELECT * FROM price_history WHERE ticker = 'AAPL' ORDER BY date ASC").all();
        expect(AAPLPrices.length).toBe(2);
        expect(AAPLPrices[0]).toMatchObject({ date: '2024-01-01', close: 150.5 });
        expect(AAPLPrices[1]).toMatchObject({ date: '2024-01-02', close: 152.0 });
    });
});
