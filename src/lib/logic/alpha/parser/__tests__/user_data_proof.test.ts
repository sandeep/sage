
import { describe, it, expect, beforeEach } from 'vitest';
import { parseTransactionCsv } from '../csvParser';
import db from '@/lib/db/client';

describe('Alpha Hardened Ingestion Proof', () => {
    beforeEach(() => {
        db.prepare(`
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
        `).run();
        db.prepare("DELETE FROM alpha_transactions").run();
    });

    it('should correctly ingest user data with M/D/YYYY dates and metadata slop', async () => {
        const csvContent = `"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"
"3/27/2026","3/27/2026","3/27/2026","","Futures Inter-Entity Cash Transfer","FUTSWP","","","($7,446.46)"
"3/26/2026","3/26/2026","3/26/2026","","Futures Inter-Entity Cash Transfer","FUTSWP","","","($145.08)"
"3/25/2026","3/25/2026","3/25/2026","","Futures Inter-Entity Cash Transfer","FUTSWP","","","$5,948.54"
"1/29/2026","1/29/2026","1/30/2026","META","Meta Platforms\nCUSIP: 30303M102","Sell","20","$740.00","$14,800.00"
""
"","","","","","","","","","The data provided is for informational purposes only..."`;

        const summary = await parseTransactionCsv(csvContent, 'final_user_test.csv');
        
        console.log(`[VERIFICATION] Ingested: ${summary.ingested}, Duplicates: ${summary.duplicates}, Skipped: ${summary.skipped}`);
        
        // ASSERT: 4 valid rows (3 FUTSWP, 1 META)
        expect(summary.ingested).toBe(4);
        
        // Verify a specific row was converted to YYYY-MM-DD
        const row = db.prepare("SELECT activity_date FROM alpha_transactions WHERE amount = 5948.54").get() as any;
        expect(row.activity_date).toBe('2026-03-25');
    });
});
