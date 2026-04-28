
import { describe, it, expect, beforeEach } from 'vitest';
import { parseFuturesStatement } from '../futuresStatementParser';
import db from '../../../../db/client';

describe('futuresStatementParser', () => {
    beforeEach(() => {
        // Setup tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS alpha_futures_specs (
                symbol      TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                multiplier  REAL NOT NULL,
                tick_size   REAL NOT NULL,
                tick_value  REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS alpha_futures_fills (
                id               INTEGER PRIMARY KEY,
                source_file      TEXT NOT NULL,
                trade_date       TEXT NOT NULL,
                symbol           TEXT NOT NULL,
                contract_month   TEXT NOT NULL,
                qty_long         REAL NOT NULL DEFAULT 0,
                qty_short        REAL NOT NULL DEFAULT 0,
                trade_price      REAL NOT NULL,
                multiplier       REAL NOT NULL,
                UNIQUE(source_file, trade_date, symbol, contract_month, trade_price, qty_long, qty_short)
            );
        `);
        db.exec('DELETE FROM alpha_futures_fills');
        db.exec('DELETE FROM alpha_futures_specs');
        
        // Seed specs
        db.exec("INSERT INTO alpha_futures_specs VALUES ('MES', 'Micro S&P 500', 5, 0.25, 1.25)");
        db.exec("INSERT INTO alpha_futures_specs VALUES ('MNQ', 'Micro Nasdaq 100', 2, 0.25, 0.50)");
    });

    it('parses valid futures statement and extracts fills correctly', async () => {
        const pdfText = `
            ROBINHOOD DERIVATIVES
            Statement Period: 02/01/2025 - 02/28/2025
            
            Monthly Trade Confirmations
            Trade Date AT Qty Long Qty Short Subtype Symbol Contract Year Month Exchange Exp Date Trade Price Currency Code Trade Type Description
            2025-02-15 B 1 0 Future MES 2025 3 CME 2025-03-21 5100.25 USD Trade Description
            2025-02-15 S 0 1 Future MES 2025 3 CME 2025-03-21 5110.50 USD Trade Description
            2025-02-16 B 5 0 Future MNQ 2025 6 CME 2025-06-20 18500.75 USD Trade Description
        `;
        const count = await parseFuturesStatement(pdfText, 'futures_2025_02.pdf');
        expect(count).toBe(3);

        const rows = db.prepare('SELECT * FROM alpha_futures_fills ORDER BY trade_date, symbol').all() as any[];
        expect(rows.length).toBe(3);
        
        expect(rows[0].symbol).toBe('MES');
        expect(rows[0].qty_long).toBe(1);
        expect(rows[0].trade_price).toBe(5100.25);
        expect(rows[0].multiplier).toBe(5);
        expect(rows[0].contract_month).toBe('2025-03');

        expect(rows[2].symbol).toBe('MNQ');
        expect(rows[2].qty_long).toBe(5);
        expect(rows[2].contract_month).toBe('2025-06');
        expect(rows[2].multiplier).toBe(2);
    });

    it('handles deduplication', async () => {
        const pdfText = `
            Monthly Trade Confirmations
            Trade Date AT Qty Long Qty Short Subtype Symbol Contract Year Month Exchange Exp Date Trade Price Currency Code Trade Type Description
            2025-02-15 B 1 0 Future MES 2025 3 CME 2025-03-21 5100.25 USD Trade Description
            2025-02-15 B 1 0 Future MES 2025 3 CME 2025-03-21 5100.25 USD Trade Description
        `;
        const count = await parseFuturesStatement(pdfText, 'futures_dup.pdf');
        expect(count).toBe(1);
    });

    it('returns 0 if no trade confirmations table is found', async () => {
        const pdfText = `Some other text`;
        const count = await parseFuturesStatement(pdfText, 'other.pdf');
        expect(count).toBe(0);
    });
});
