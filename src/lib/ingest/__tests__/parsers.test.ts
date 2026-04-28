// src/lib/ingest/__tests__/parsers.test.ts
import { parseFidelityHoldings, parseSchwabHoldings } from '../parsers';
import { describe, it, expect } from 'vitest';

describe('parsers', () => {
    it('parseFidelityHoldings handles the real CSV format and CORE** cash', () => {
        const csv = `Account Number,Account Name,Symbol,Description,Quantity,Last Price,Last Price Change,Current Value,Today's Gain/Loss Dollar,Today's Gain/Loss Percent,Total Gain/Loss Dollar,Total Gain/Loss Percent,Percent Of Account,Cost Basis Total,Average Cost Basis,Type
180741213,Rollover IRA,FZROX,FIDELITY ZERO TOTAL MARKET INDEX,5964.336,$23.36,-$0.33,$139326.88,-$1968.24,-1.40%,+$49326.88,+54.80%,100.00%,$90000.00,$15.09,Cash
218595652,Traditional IRA,CORE**,FDIC-INSURED DEPOSIT SWEEP,,,,$44150.44,,,,,18.81%,,,Cash`;

        const result = parseFidelityHoldings(csv);
        expect(result.holdings[0].ticker).toBe('FZROX');
        expect(result.holdings[0].quantity).toBe(5964.336);
        expect(result.holdings[1].ticker).toBe('CASH');
        expect(result.holdings[1].quantity).toBe(44150.44);
    });

    it('parseFidelityHoldings identifies 1256 contracts', () => {
        const csv = 'Symbol,Description,Quantity,Price,Basis\n/ES,E-MINI S&P 500,1.0,5000.0,4800.0';
        const result = parseFidelityHoldings(csv);
        expect(result.holdings[0].ticker).toBe('/ES');
        expect(result.holdings[0].assetType).toBe('1256');
    });
});

describe('parseFidelityHoldings — ParseResult', () => {
    const HEADER = `Account Number,Account Name,Symbol,Description,Quantity,Last Price,Last Price Change,Current Value,Today's Gain/Loss Dollar,Today's Gain/Loss Percent,Total Gain/Loss Dollar,Total Gain/Loss Percent,Percent Of Account,Cost Basis Total,Average Cost Basis,Type`;

    it('returns holdings array, skipped array, and unmapped array', () => {
        const csv = [
            HEADER,
            `180741213,Rollover IRA,FZROX,FIDELITY ZERO TOTAL MARKET,5964.336,$23.36,,$139326.88,,,,,,,$90000.00,,Cash`,
            `218595652,Traditional IRA,CORE**,FDIC-INSURED DEPOSIT SWEEP,,,,$44150.44,,,,,18.81%,,,Cash`,
            `,,,,,,,,,,,,,,, `,
        ].join('\n');

        const result = parseFidelityHoldings(csv);
        expect(result.holdings).toHaveLength(2);
        expect(result.skipped.length).toBeGreaterThanOrEqual(1);
        expect(result.unmapped).toBeDefined();
    });

    it('uses positional fallback when header names differ', () => {
        const badHeader = `Account Number,Account Name,Sym,Desc,Qty,Last Price,Last Price Change,Curr Val,,,,,,,, `;
        const csv = [
            badHeader,
            `180741213,Rollover IRA,FXAIX,Fidelity 500,100.0,$230.91,,$23091.00,,,,,,,,`,
        ].join('\n');

        const result = parseFidelityHoldings(csv);
        expect(result.holdings[0].ticker).toBe('FXAIX');
        expect(result.holdings[0].quantity).toBe(100.0);
        expect(result.holdings[0].marketValue).toBe(23091.0);
    });

    it('includes reason in skipped rows', () => {
        const csv = [
            HEADER,
            `,,,empty row,0,,,$0,,,,,,,,`,
        ].join('\n');
        const result = parseFidelityHoldings(csv);
        expect(result.skipped.length).toBeGreaterThan(0);
        expect(result.skipped[0].reason).toBeTruthy();
    });
});
