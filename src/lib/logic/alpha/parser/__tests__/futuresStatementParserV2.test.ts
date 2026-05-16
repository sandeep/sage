import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { parseFuturesStatement } from '../futuresStatementParser';
import db from '../../../../db/client';
import { setupTestDb } from '../../../../db/__tests__/setup';

describe('futuresStatementParser V2 Upgrade', () => {
    beforeAll(() => {
        setupTestDb();
    });

    beforeEach(() => {
        db.exec("DELETE FROM alpha_futures_fills");
        db.exec("DELETE FROM alpha_futures_journal");
    });

    const mockPdfText = `
MONTHLY TRADE CONFIRMATIONS
Trade Date AT Qty Long Qty Short Subtype Symbol Contract Year Month Exchange Exp Date Trade Price Currency Code Trade Type Description
2026-04-21 US 1.00 0.00 SIC 2026 5 XCEC 2026-04-28 78.55000000 USD Trade SIC
2026-04-21 US 0.00 1.00 SIL 2026 5 XCEC 2026-05-27 76.57000000 USD Trade SIL

TRADE CONFIRMATION SUMMARY
Trade Date AT Total Qty Long Total Qty Short Subtype Symbol Description Contract Year Month Exchange Exp Date Commission Exchange Fees NFA Fees Total Commissions and Fees Currency Code
2026-04-21 US 1.00 0.00 SIC SIC 2026 5 XCEC 2026-04-28 -3.500000 -3.500000 -0.14 -7.14 USD
2026-04-21 US 0.00 1.00 SIL SIL 2026 5 XCEC 2026-05-27 -1.000000 -2.200000 -0.04 -3.24 USD

JOURNAL ENTRIES
Date AT Description Currency Credit/Debit
2026-04-13 US Deposit USD 787.94
2026-04-23 US Withdrawal USD -9486.18

OPEN POSITIONS
`;

    it('extracts fills, commissions, and journal entries', async () => {
        const recordsParsed = await parseFuturesStatement(mockPdfText, 'RH_Statement.pdf');
        expect(recordsParsed).toBe(2);

        const fills = db.prepare("SELECT * FROM alpha_futures_fills ORDER BY symbol").all() as any[];
        expect(fills.length).toBe(2);

        // Verify SIC fill and commissions
        const sic = fills.find(f => f.symbol === 'SIC');
        expect(sic.qty_long).toBe(1);
        expect(sic.commission).toBe(3.50);
        expect(sic.exchange_fees).toBe(3.50);
        expect(sic.nfa_fees).toBe(0.14);

        // Verify SIL fill and commissions
        const sil = fills.find(f => f.symbol === 'SIL');
        expect(sil.qty_short).toBe(1);
        expect(sil.commission).toBe(1.00);
        expect(sil.exchange_fees).toBe(2.20);
        expect(sil.nfa_fees).toBe(0.04);

        const journals = db.prepare("SELECT * FROM alpha_futures_journal ORDER BY trade_date").all() as any[];
        expect(journals.length).toBe(2);
        expect(journals[0].description).toBe('Deposit');
        expect(journals[0].amount).toBe(787.94);
        expect(journals[1].description).toBe('Withdrawal');
        expect(journals[1].amount).toBe(-9486.18);
    });

    it('handles overlapping file deduplication', async () => {
        // Import file 1
        await parseFuturesStatement(mockPdfText, 'RH_Statement_1.pdf');
        
        // Import file 2 (overlapping, same data)
        const newRecords = await parseFuturesStatement(mockPdfText, 'RH_Statement_2.pdf');
        
        // It shouldn't count them as "new records parsed"
        expect(newRecords).toBe(0);

        const fills = db.prepare("SELECT * FROM alpha_futures_fills").all() as any[];
        expect(fills.length).toBe(2); // Should still only be 2

        const journals = db.prepare("SELECT * FROM alpha_futures_journal").all() as any[];
        expect(journals.length).toBe(2); // Should still only be 2
    });
});
