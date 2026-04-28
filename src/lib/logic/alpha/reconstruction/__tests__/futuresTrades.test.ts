import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db/client';
import { runMigrations } from '@/lib/db/migrate';
import { setupTestDb } from '@/lib/db/__tests__/setup';
import { reconstructFuturesTrades } from '../futuresTrades';

describe('futuresTrades reconstruction', () => {
    beforeEach(() => {
        // Initialize test database schema
        setupTestDb();
        
        // Run Alpha migrations (which are in runMigrations)
        runMigrations(db);
        
        // Clear tables
        db.prepare('DELETE FROM alpha_futures_fills').run();
        db.prepare('DELETE FROM alpha_futures_trades').run();
    });

    it('should reconstruct a simple LONG round trip', async () => {
        // Arrange
        const symbol = 'MES';
        const contract_month = '2026-03';
        const multiplier = 5;

        // BTO 1 @ 5000
        db.prepare(`
            INSERT INTO alpha_futures_fills (source_file, trade_date, symbol, contract_month, qty_long, qty_short, trade_price, multiplier)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('test.pdf', '2026-01-01', symbol, contract_month, 1, 0, 5000, multiplier);

        // STC 1 @ 5100
        db.prepare(`
            INSERT INTO alpha_futures_fills (source_file, trade_date, symbol, contract_month, qty_long, qty_short, trade_price, multiplier)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('test.pdf', '2026-01-02', symbol, contract_month, 0, 1, 5100, multiplier);

        // Act
        const count = await reconstructFuturesTrades();

        // Assert
        expect(count).toBe(1);
        const trades = db.prepare('SELECT * FROM alpha_futures_trades').all() as any[];
        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({
            symbol,
            contract_month,
            direction: 'LONG',
            open_date: '2026-01-01',
            open_price: 5000,
            close_date: '2026-01-02',
            close_price: 5100,
            qty: 1,
            net_pnl: (5100 - 5000) * 1 * multiplier // 100 * 5 = 500
        });
    });

    it('should reconstruct a simple SHORT round trip', async () => {
        // Arrange
        const symbol = 'MES';
        const contract_month = '2026-03';
        const multiplier = 5;

        // STO 1 @ 5100
        db.prepare(`
            INSERT INTO alpha_futures_fills (source_file, trade_date, symbol, contract_month, qty_long, qty_short, trade_price, multiplier)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('test.pdf', '2026-01-01', symbol, contract_month, 0, 1, 5100, multiplier);

        // BTC 1 @ 5000
        db.prepare(`
            INSERT INTO alpha_futures_fills (source_file, trade_date, symbol, contract_month, qty_long, qty_short, trade_price, multiplier)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('test.pdf', '2026-01-02', symbol, contract_month, 1, 0, 5000, multiplier);

        // Act
        await reconstructFuturesTrades();

        // Assert
        const trades = db.prepare('SELECT * FROM alpha_futures_trades').all() as any[];
        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({
            direction: 'SHORT',
            open_date: '2026-01-01',
            open_price: 5100,
            close_date: '2026-01-02',
            close_price: 5000,
            qty: 1,
            net_pnl: (5100 - 5000) * 1 * multiplier // 500
        });
    });
});
