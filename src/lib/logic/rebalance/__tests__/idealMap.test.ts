
import { describe, it, expect } from 'vitest';
import { generateIdealMap, AccountCapacity } from '../idealMap';

describe('idealMap Blueprint Generator', () => {
    const ACCOUNTS: AccountCapacity[] = [
        { id: 'roth', type: 'ROTH', totalValue: 50000 },
        { id: 'ira', type: 'DEFERRED', totalValue: 50000 },
        { id: 'taxable', type: 'TAXABLE', totalValue: 100000 }
    ];

    const PRIORITIES = {
        'AVUV': { tier: 'efficient', priority: ['ROTH', 'DEFERRED', 'TAXABLE'] },
        'FSRNX': { tier: 'very_inefficient', priority: ['DEFERRED', 'ROTH', 'TAXABLE'] },
        'VTI': { tier: 'efficient', priority: ['TAXABLE', 'ROTH', 'DEFERRED'] }
    };

    it('fills Roth with growth (SCV) and Deferred with inefficient (REITs)', () => {
        const TARGET = {
            'VTI': 0.50,   // $100k
            'FSRNX': 0.25, // $50k (REIT -> Deferred)
            'AVUV': 0.25   // $50k (SCV -> Roth)
        };
        const total = 200000;
        const result = generateIdealMap(total, TARGET, ACCOUNTS, PRIORITIES);

        // ROTH should have $50k of AVUV (SCV)
        expect(result['roth']['AVUV']).toBe(50000);
        
        // DEFERRED should have $50k of FSRNX (REIT)
        expect(result['ira']['FSRNX']).toBe(50000);

        // TAXABLE should have $100k of VTI (Core)
        expect(result['taxable']['VTI']).toBe(100000);
    });

    it('handles spillover when an account type is full', () => {
        // SCV goal is $100k, but Roth only has $50k space
        const bigTarget = { 'AVUV': 0.50, 'VTI': 0.50 }; 
        const total = 200000;
        const result = generateIdealMap(total, bigTarget, ACCOUNTS, PRIORITIES);

        // Roth gets first $50k of AVUV
        expect(result['roth']['AVUV']).toBe(50000);
        
        // Remaining $50k AVUV spills to Deferred (next preferred)
        expect(result['ira']['AVUV']).toBe(50000);
    });
});
