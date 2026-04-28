
import { describe, it, expect, beforeEach } from 'vitest';
import { calculateHistoricalProxyReturns } from '../simbaEngine';
import { setupTestDb } from '../../../lib/db/__tests__/setup';

describe('simbaEngine', () => {
    beforeEach(() => {
        setupTestDb();
    });

    it('returns empty result when no weights match', () => {
        const result = calculateHistoricalProxyReturns({ "UNKNOWN": 1.0 }, 5);
        expect(result.annualizedReturn).toBe(0);
        expect(result.coveragePct).toBe(0);
    });

    it('calculates returns for a single ticker (VTI)', () => {
        const result = calculateHistoricalProxyReturns({ "VTI": 1.0 }, 1);
        // VTI 2025 return in simba_returns.json is approx 17.12%
        expect(result.annualizedReturn).toBeCloseTo(0.1712, 4);
        expect(result.coveragePct).toBe(1.0);
    });

    it('handles mixed portfolio correctly', () => {
        const result = calculateHistoricalProxyReturns({ "TSM": 0.5, "Cash": 0.5 }, 1);
        // 0.5 * 0.1712 + 0.5 * 0 = 0.0856
        expect(result.annualReturns[0]).toBeCloseTo(0.0856, 4);
    });
});
