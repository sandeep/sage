
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

describe('Systematic Recompute Debug with Canonical Data', () => {
    it('should process the full user-provided CSV without errors', async () => {
        console.log('--- SYSTEMATIC DEBUG START ---');
        
        runMigrations(db);

        // 1. Reset Alpha Tables
        console.log('1. Resetting Alpha tables...');
        db.prepare('DELETE FROM alpha_transactions').run();
        db.prepare('DELETE FROM alpha_futures_fills').run();
        db.prepare('DELETE FROM alpha_futures_trades').run();
        db.prepare('DELETE FROM alpha_option_trades').run();
        db.prepare('DELETE FROM alpha_equity_trades').run();
        db.prepare('DELETE FROM alpha_daily_pnl').run();
        
        // 2. Test CSV Parsing
        console.log('2. Testing CSV Parsing with AAAA-32a0dca0-7359-5675-9efa-629ca2c43781.csv...');
        const csvPath = '/Users/sandeep/Developer/sage2.0/AAAA-32a0dca0-7359-5675-9efa-629ca2c43781.csv';
        if (!fs.existsSync(csvPath)) {
            throw new Error(`Canonical test file not found at: ${csvPath}`);
        }
        const csvContent = fs.readFileSync(csvPath, 'utf-8');

        const count = await parseTransactionCsv(csvContent, 'AAAA-32a0dca0-7359-5675-9efa-629ca2c43781.csv');
        console.log(`   ✓ Parsed ${count} transactions.`);
        expect(count).toBeGreaterThan(0);

        // 3. Test Trade Reconstruction
        console.log('3. Testing Trade Reconstruction...');
        const futuresCount = await reconstructFuturesTrades();
        const optionCount = await reconstructOptionTrades();
        const equityCount = await reconstructEquityTrades();
        console.log(`   ✓ Reconstruction Complete - Futures: ${futuresCount}, Options: ${optionCount}, Equities: ${equityCount}`);

        // 4. Test P&L Aggregation
        console.log('4. Testing P&L Aggregation...');
        await aggregateDailyPnl();
        console.log('   ✓ P&L Aggregation Complete.');

        // 5. Inspect Results
        console.log('5. Inspecting Final Data...');
        const pnl = db.prepare('SELECT * FROM alpha_daily_pnl').all();
        console.log('   Daily P&L Rows:', pnl.length);
        console.table(pnl);
        
        const trades = db.prepare('SELECT * FROM alpha_equity_trades').all();
        console.log('   Equity Trades:', trades.length);
        console.table(trades);

        console.log('--- DEBUG SUCCESSFUL ---');
    });
});
