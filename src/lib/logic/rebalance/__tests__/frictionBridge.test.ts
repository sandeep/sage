
import { describe, it, expect, beforeEach } from 'vitest';
import { generateReconciliationTrades, ActualHoldingsMap } from '../frictionBridge';
import { IdealPortfolioMap } from '../idealMap';
import { setupTestDb } from '../../../../lib/db/__tests__/setup';

describe('frictionBridge Trade Generator', () => {
    beforeEach(() => { setupTestDb(); });

    const accountLabels = new Map([
        ['roth', { label: 'ROTH IRA', provider: 'FIDELITY' }],
        ['taxable', { label: 'TAXABLE', provider: 'FIDELITY' }],
    ]);

    it('generates an internal swap when an account is both over and under', () => {
        const ideal: IdealPortfolioMap = {
            'roth': { 'AVUV': 10000, 'VTI': 0 }
        };
        const actual: ActualHoldingsMap = {
            'roth': { 'VTI': { quantity: 100, value: 10000 } }
        };

        const trades = generateReconciliationTrades(ideal, actual, accountLabels);
        
        expect(trades).toHaveLength(1);
        expect(trades[0].type).toBe('REBALANCE');
        expect(trades[0].description).toContain('VTI → AVUV');
    });

    it('generates a standalone sell when only overweight', () => {
        const ideal: IdealPortfolioMap = { 'taxable': { 'VTI': 5000 } };
        const actual: ActualHoldingsMap = { 'taxable': { 'VTI': { quantity: 100, value: 10000 } } };

        const trades = generateReconciliationTrades(ideal, actual, accountLabels);
        expect(trades[0].type).toBe('SELL');
        expect(trades[0].description).toContain('Trim $5.0k VTI');
    });
});
