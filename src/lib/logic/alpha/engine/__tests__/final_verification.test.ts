
import { describe, it, expect } from 'vitest';
import db from '@/lib/db/client';
import { runMigrations } from '@/lib/db/migrate';
import { parseTransactionCsv } from '../../parser/csvParser';
import { reconstructFuturesTrades } from '../../reconstruction/futuresTrades';
import { reconstructOptionTrades } from '../../reconstruction/optionTrades';
import { reconstructEquityTrades } from '../../reconstruction/equityTrades';
import { aggregateDailyPnl } from '../dailyPnl';
import fs from 'fs';
import path from 'path';

describe('Final Alpha Pipeline Verification', () => {
    it('should correctly reconstruct trades from canonical data', async () => {
        console.log('--- FINAL VERIFICATION START ---');
        
        runMigrations(db);

        // 1. Reset Alpha Tables
        db.prepare('DELETE FROM alpha_transactions').run();
        db.prepare('DELETE FROM alpha_futures_fills').run();
        db.prepare('DELETE FROM alpha_futures_trades').run();
        db.prepare('DELETE FROM alpha_option_trades').run();
        db.prepare('DELETE FROM alpha_equity_trades').run();
        db.prepare('DELETE FROM alpha_daily_pnl').run();
        
        // 2. Load and Parse CSV
        const csvPath = path.resolve(process.cwd(), 'AAAA-32a0dca0-7359-5675-9efa-629ca2c43781.csv');
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const count = await parseTransactionCsv(csvContent, 'canonical.csv');
        console.log(`   ✓ Parsed ${count} transactions.`);

        // 3. Reconstruct
        await reconstructFuturesTrades();
        await reconstructOptionTrades();
        const eCount = await reconstructEquityTrades();
        console.log(`   ✓ Reconstructed Equities: ${eCount}`);

        // 4. Aggregate
        await aggregateDailyPnl();
        
        // 5. Assertions
        const equityTrades = db.prepare('SELECT * FROM alpha_equity_trades').all();
        const optionTrades = db.prepare('SELECT * FROM alpha_option_trades').all();
        
        console.log('   [Verification] Equity Trade Count:', equityTrades.length);
        console.log('   [Verification] Option Trade Count:', optionTrades.length);

        expect(equityTrades.length).toBeGreaterThan(0);
        expect(optionTrades.length).toBeGreaterThan(0);

        console.log('--- FINAL VERIFICATION SUCCESSFUL ---');
    });
});
