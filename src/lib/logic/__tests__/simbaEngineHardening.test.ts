
import { describe, it, expect } from 'vitest';
import { calculateHistoricalProxyReturns, TICKER_TO_SIMBA, LABEL_TO_SIMBA } from '../simbaEngine';

describe('simbaEngine Hardening', () => {
    it('should have mappings for VIIIX, FSPSX, and VBR', () => {
        expect(TICKER_TO_SIMBA['VIIIX']).toBe('LCB');
        expect(TICKER_TO_SIMBA['FSPSX']).toBe('INTL');
        expect(TICKER_TO_SIMBA['VBR']).toBe('SCV');
    });

    it('should have mappings for specific labels', () => {
        expect(LABEL_TO_SIMBA['US Large Cap/SP500/DJIX']).toBe('LCB');
        expect(LABEL_TO_SIMBA["Intl'l Stock"]).toBe('INTL');
    });

    it('should calculate returns for specific years', () => {
        const weights = { 'VTI': 1 };
        // 2008 was a bad year for VTI/TSM
        const result = calculateHistoricalProxyReturns(weights, 10, [2008]);
        expect(result.years).toEqual([2008]);
        expect(result.annualReturns.length).toBe(1);
        // From simba_returns.json, TSM/VTI 2008 return is -0.3699
        expect(result.annualReturns[0]).toBeCloseTo(-0.3699, 4);
    });

    it('should calculate returns for multiple specific years', () => {
        const weights = { 'VTI': 1 };
        const result = calculateHistoricalProxyReturns(weights, 10, [2000, 2001, 2002]);
        expect(result.years).toEqual([2000, 2001, 2002]);
        expect(result.annualReturns.length).toBe(3);
        // 2000: -0.1057, 2001: -0.1089, 2002: -0.2095
        expect(result.annualReturns[0]).toBeCloseTo(-0.1057, 4);
        expect(result.annualReturns[1]).toBeCloseTo(-0.1089, 4);
        expect(result.annualReturns[2]).toBeCloseTo(-0.2095, 4);
    });

    it('should handle mixed ticker and label weights', () => {
        const weights = { 
            'VIIIX': 0.5, // Ticker -> LCB
            'Small Cap Value': 0.5 // Label -> SCV
        };
        const result = calculateHistoricalProxyReturns(weights, 1, [2008]);
        // LCB 2008: -0.3697, SCV 2008: -0.3205
        // Expected: 0.5 * -0.3697 + 0.5 * -0.3205 = -0.3451
        expect(result.annualReturns[0]).toBeCloseTo(-0.3451, 4);
    });
});
