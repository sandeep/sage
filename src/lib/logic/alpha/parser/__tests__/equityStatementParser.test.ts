
import { describe, it, expect, beforeEach } from 'vitest';
import { parseEquityStatement } from '../equityStatementParser';
import db from '../../../../db/client';

describe('equityStatementParser', () => {
    beforeEach(() => {
        // Setup alpha_nav_snapshots table for testing
        db.exec(`
            CREATE TABLE IF NOT EXISTS alpha_nav_snapshots (
                month               TEXT PRIMARY KEY,
                opening_balance     REAL NOT NULL,
                closing_balance     REAL NOT NULL,
                source_file         TEXT NOT NULL
            )
        `);
        db.exec('DELETE FROM alpha_nav_snapshots');
    });

    it('parses valid equity statement and extracts NAV correctly', async () => {
        const pdfText = `
            Individual Investing
            Account: 123456789
            Period: 2025-02-01 to 2025-02-28
            
            Account Summary
            Opening Balance $10,000.00
            Deposits $500.00
            Withdrawals $0.00
            Dividends $10.00
            Change in Value $1,990.00
            Closing Balance $12,500.00
        `;
        const success = await parseEquityStatement(pdfText, 'equity_2025_02.pdf');
        expect(success).toBe(true);

        const rows = db.prepare('SELECT * FROM alpha_nav_snapshots').all() as any[];
        expect(rows.length).toBe(1);
        expect(rows[0].month).toBe('2025-02');
        expect(rows[0].opening_balance).toBe(10000.00);
        expect(rows[0].closing_balance).toBe(12500.00);
        expect(rows[0].source_file).toBe('equity_2025_02.pdf');
    });

    it('handles different date header format', async () => {
        const pdfText = `
            Individual Investing
            Account: 123456789
            Date: 2025-03-31
            
            Account Summary
            Opening Balance $12,500.00
            Closing Balance $13,000.00
        `;
        const success = await parseEquityStatement(pdfText, 'equity_2025_03.pdf');
        expect(success).toBe(true);

        const rows = db.prepare("SELECT * FROM alpha_nav_snapshots WHERE month = '2025-03'").all() as any[];
        expect(rows.length).toBe(1);
        expect(rows[0].opening_balance).toBe(12500.00);
        expect(rows[0].closing_balance).toBe(13000.00);
    });

    it('returns false if Account Summary is missing', async () => {
        const pdfText = `Some random text without account summary`;
        const success = await parseEquityStatement(pdfText, 'random.pdf');
        expect(success).toBe(false);
    });

    it('handles comma in balance amounts', async () => {
        const pdfText = `
            Individual Investing
            Period: 2025-01-01 to 2025-01-31
            Account Summary
            Opening Balance $100,000.00
            Closing Balance $105,250.75
        `;
        await parseEquityStatement(pdfText, 'equity_2025_01.pdf');
        const row = db.prepare("SELECT * FROM alpha_nav_snapshots WHERE month = '2025-01'").get() as any;
        expect(row.opening_balance).toBe(100000.00);
        expect(row.closing_balance).toBe(105250.75);
    });
});
