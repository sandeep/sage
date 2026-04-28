
import { describe, it, expect } from 'vitest';
import { calculateM2, calculateAlpha, calculateCaptureRatios } from '../performanceMetrics';

describe('Performance Institutional Math Helpers', () => {
    // TEST ANCHORS (Determined by Master Spreadsheet)
    const RF = 0.05;
    const PORT_RETURN = 0.12;
    const BENCH_RETURN = 0.10;
    const BENCH_VOL = 0.15;
    const PORT_SHARPE = 0.13; // (0.12 - 0.05) / 0.15 = 0.46 risk-adjusted
    
    // M2 = (Sharpe_p * Vol_b) + Rf
    // M2 = (0.13 * 0.15) + 0.05 = 0.0195 + 0.05 = 0.0695
    const EXPECTED_M2 = 0.0695;

    it('should calculate M2 correctly based on audit ground truth', () => {
        const m2 = calculateM2(PORT_SHARPE, BENCH_VOL, RF);
        expect(m2).toBeCloseTo(EXPECTED_M2, 4);
    });

    it('should calculate Alpha correctly', () => {
        const BETA = 1.2;
        // CAPM = Rf + beta * (Bench - Rf)
        // CAPM = 0.05 + 1.2 * (0.10 - 0.05) = 0.05 + 0.06 = 0.11
        // Alpha = Port - CAPM = 0.12 - 0.11 = 0.01
        const expectedAlpha = 0.01;

        const alpha = calculateAlpha(PORT_RETURN, BENCH_RETURN, BETA, RF);
        expect(alpha).toBeCloseTo(expectedAlpha, 6);
    });
});
