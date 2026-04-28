import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db/client';
import { runMigrations } from '@/lib/db/migrate';
import { setupTestDb } from '@/lib/db/__tests__/setup';
import { reconstructOptionTrades } from '../optionTrades';

describe('optionTrades reconstruction', () => {
    beforeEach(() => {
        setupTestDb();
        runMigrations(db);
        db.prepare('DELETE FROM alpha_transactions').run();
        db.prepare('DELETE FROM alpha_option_trades').run();
    });

    it('should reconstruct a simple STO/BTC round trip', async () => {
        const description = 'HOOD 8/8/2025 Call $105.00';
        const instrument = 'HOOD';

        // STO 1 @ $1.50
        db.prepare(`
            INSERT INTO alpha_transactions (source_file, activity_date, instrument, description, trans_code, quantity, price, amount, book)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('test.csv', '2025-01-01', instrument, description, 'STO', -1, 1.5, 150, 'OPTION');

        // BTC 1 @ $0.50
        db.prepare(`
            INSERT INTO alpha_transactions (source_file, activity_date, instrument, description, trans_code, quantity, price, amount, book)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('test.csv', '2025-01-05', instrument, description, 'BTC', 1, 0.5, -50, 'OPTION');

        const count = await reconstructOptionTrades();

        expect(count).toBe(1);
        const trades = db.prepare('SELECT * FROM alpha_option_trades').all() as any[];
        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({
            instrument,
            option_key: description,
            option_type: 'CALL',
            strike: 105,
            expiry: '8/8/2025',
            direction: 'SHORT',
            open_code: 'STO',
            open_premium: 150,
            close_code: 'BTC',
            close_premium: -50,
            net_pnl: 100,
            outcome: 'CLOSED'
        });
    });

    it('should handle OEXP (expired) options', async () => {
        const description = 'AAPL 1/1/2026 Put $200.00';
        const instrument = 'AAPL';

        // BTO 1 @ $5.00
        db.prepare(`
            INSERT INTO alpha_transactions (source_file, activity_date, instrument, description, trans_code, quantity, price, amount, book)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('test.csv', '2025-12-01', instrument, description, 'BTO', 1, 5, -500, 'OPTION');

        // OEXP
        db.prepare(`
            INSERT INTO alpha_transactions (source_file, activity_date, instrument, description, trans_code, quantity, price, amount, book)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('test.csv', '2026-01-01', instrument, description, 'OEXP', -1, 0, 0, 'OPTION');

        await reconstructOptionTrades();

        const trades = db.prepare('SELECT * FROM alpha_option_trades').all() as any[];
        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({
            direction: 'LONG',
            outcome: 'EXPIRED',
            net_pnl: -500
        });
    });

    it('should keep open positions in the table', async () => {
        const description = 'TSLA 12/12/2025 Call $300.00';
        
        // STO 1 @ $10.00
        db.prepare(`
            INSERT INTO alpha_transactions (source_file, activity_date, instrument, description, trans_code, quantity, price, amount, book)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('test.csv', '2025-11-01', 'TSLA', description, 'STO', -1, 10, 1000, 'OPTION');

        await reconstructOptionTrades();

        const trades = db.prepare('SELECT * FROM alpha_option_trades').all() as any[];
        expect(trades).toHaveLength(1);
        expect(trades[0].outcome).toBe('OPEN');
        expect(trades[0].close_date).toBeNull();
    });
});
