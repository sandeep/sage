
import { describe, it, expect, beforeEach } from 'vitest';
import { parseTransactionCsv } from '../csvParser';
import db from '../../../../db/client';

describe('csvParser', () => {
    beforeEach(() => {
        // Setup alpha_transactions table for testing
        db.exec(`
            CREATE TABLE IF NOT EXISTS alpha_transactions (
                id              INTEGER PRIMARY KEY,
                source_file     TEXT NOT NULL,
                activity_date   TEXT NOT NULL,
                instrument      TEXT,
                description     TEXT,
                trans_code      TEXT NOT NULL,
                quantity        REAL,
                price           REAL,
                amount          REAL,
                book            TEXT NOT NULL
            )
        `);
        db.exec('DELETE FROM alpha_transactions');
    });

    it('parses valid CSV transactions correctly', async () => {
        const csvContent = `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
2025-01-02,2025-01-02,2025-01-02,AAPL,Apple Inc. - Common Stock,Buy,10,150.00,"($1,500.00)"
2025-01-03,2025-01-03,2025-01-03,HOOD 01/17/25 Call $20.00,Buy to Close,BTC,1,2.50,"($250.00)"
2025-01-04,2025-01-04,2025-01-04,TSLA 01/17/25 Call $200.00,Tesla Call,BTO,1,5.00,"($500.00)"
2025-01-05,2025-01-05,2025-01-05,,ACH DEPOSIT,ACH,,5000.00,"$5,000.00"
2025-01-06,2025-01-06,2025-01-06,,FUTURES CASH SETTLEMENT,FUTSWP,,,125.50
2025-01-07,2025-01-07,2025-01-07,,Monthly Gold Fee,GOLD,,5.00,"($5.00)"
2025-01-08,2025-01-08,2025-01-08,,Interest,INT,,1.25,$1.25
`;
        const count = await parseTransactionCsv(csvContent, 'test.csv');
        expect(count).toBe(7);

        const rows = db.prepare('SELECT * FROM alpha_transactions ORDER BY activity_date').all() as any[];
        expect(rows[0].book).toBe('EQUITY');
        expect(rows[0].amount).toBe(-1500.00);
        expect(rows[0].instrument).toBe('AAPL');

        expect(rows[1].book).toBe('OPTION'); 
        expect(rows[1].trans_code).toBe('BTC');

        expect(rows[2].book).toBe('OPTION');
        expect(rows[3].book).toBe('DEPOSIT');
        expect(rows[4].book).toBe('FUTURES_CASH');
        expect(rows[5].book).toBe('FEE');
        expect(rows[6].book).toBe('INCOME');
    });

    it('handles deduplication correctly', async () => {
        const csvContent = `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
2025-01-02,2025-01-02,2025-01-02,AAPL,Apple Inc. - Common Stock,Buy,10,150.00,"($1,500.00)"
2025-01-02,2025-01-02,2025-01-02,AAPL,Apple Inc. - Common Stock,Buy,10,150.00,"($1,500.00)"
`;
        const count = await parseTransactionCsv(csvContent, 'test.csv');
        expect(count).toBe(1);

        const rows = db.prepare('SELECT * FROM alpha_transactions').all();
        expect(rows.length).toBe(1);
    });

    it('skips footer and empty date rows', async () => {
        const csvContent = `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
2025-01-02,2025-01-02,2025-01-02,AAPL,Apple Inc. - Common Stock,Buy,10,150.00,"($1,500.00)"
,,,,,,,
* This is a disclaimer row
`;
        const count = await parseTransactionCsv(csvContent, 'test.csv');
        expect(count).toBe(1);
    });

    it('cleans amount strings correctly', async () => {
        const csvContent = `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
2025-01-02,2025-01-02,2025-01-02,AAPL,Apple Inc. - Common Stock,Buy,10,150.00,"$1,500.00"
2025-01-03,2025-01-03,2025-01-03,AAPL,Apple Inc. - Common Stock,Buy,10,150.00,"($1,500.00)"
2025-01-04,2025-01-04,2025-01-04,AAPL,Apple Inc. - Common Stock,Buy,10,150.00,"-1500.00"
`;
        await parseTransactionCsv(csvContent, 'test.csv');
        const rows = db.prepare('SELECT amount FROM alpha_transactions ORDER BY activity_date').all() as any[];
        expect(rows[0].amount).toBe(1500.00);
        expect(rows[1].amount).toBe(-1500.00);
        expect(rows[2].amount).toBe(-1500.00);
    });

    it('handles missing instrument and quantity', async () => {
        const csvContent = `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
2025-01-02,2025-01-02,2025-01-02,,Description only,INT,,1.00,$1.00
`;
        await parseTransactionCsv(csvContent, 'test.csv');
        const rows = db.prepare('SELECT * FROM alpha_transactions').all() as any[];
        expect(rows[0].instrument).toBe(null);
        expect(rows[0].quantity).toBe(null);
        expect(rows[0].description).toBe('Description only');
    });
});
