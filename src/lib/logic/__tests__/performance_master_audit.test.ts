
import { describe, it, expect, beforeEach } from 'vitest';
import { calculateM2, calculateAlpha } from '../performanceMetrics';
import { setupTestDb } from '../../../lib/db/__tests__/setup';

describe('Performance Engine: Master Mathematical Audit', () => {
    beforeEach(() => {
        setupTestDb();
    });

    describe('Institutional Math Helpers', () => {
        const RF = 0.05;

        it('calculates M2 correctly (The "Real" Return)', () => {
            // M2 = (Sharpe_p * Vol_b) + Rf
            // M2 = (1.0 * 0.15) + 0.05 = 0.20 (20%)
            const m2 = calculateM2(1.0, 0.15, RF);
            expect(m2).toBeCloseTo(0.20, 4);
        });

        it('calculates Jensen Alpha correctly', () => {
            // Beta = 1.2, Bench = 10%, Port = 12%, Rf = 5%
            // CAPM = 5% + 1.2 * (10% - 5%) = 11%
            // Alpha = 12% - 11% = 1% (0.01)
            const alpha = calculateAlpha(0.12, 0.10, 1.2, RF);
            expect(alpha).toBeCloseTo(0.01, 4);
        });
    });
});
