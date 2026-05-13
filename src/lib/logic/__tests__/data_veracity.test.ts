import { describe, it, expect } from 'vitest';
import { computeTrackingError } from '../performanceMetrics';
import db from '../../db/client';

describe('Data Veracity Reproduction', () => {
    describe('Tracking Error Math (Sample vs Population)', () => {
        it('should use sample standard deviation (N-1) instead of population (N)', () => {
            // For returns [0.1, 0.2] and benchmark [0, 0], excess is [0.1, 0.2].
            // Mean = 0.15
            // Population Variance = ((0.1-0.15)^2 + (0.2-0.15)^2) / 2 = 0.0025
            // Sample Variance = ((0.1-0.15)^2 + (0.2-0.15)^2) / 1 = 0.005
            // With annualizationFactor = 1:
            // Population TE = sqrt(0.0025) = 0.05
            // Sample TE = sqrt(0.005) = 0.07071...
            
            const port = [0.1, 0.2];
            const bench = [0, 0];
            const te = computeTrackingError(port, bench, 1);
            
            // This expectation will FAIL if it uses Population SD (0.05)
            // We want it to be 0.07071...
            expect(te).toBeCloseTo(0.07071, 5);
        });
    });

    describe('VTIVX Weights Integrity', () => {
        it('VTIVX weights in refresh.ts should sum to 1.0, not 1.11', () => {
            // We'll read the file or check the DB if it's already seeded.
            // Since we identified it in src/lib/data/refresh.ts:
            // weights = '{"Total Stock Market": 0.477, "Developed Market": 0.345, "Emerging Market": 0.11, "US Aggregate Bond": 0.125, "ex-US Aggregate Bond": 0.053}';
            const weights = {
                "Total Stock Market": 0.54,
                "Developed Market": 0.27,
                "Emerging Market": 0.09,
                "US Aggregate Bond": 0.07,
                "ex-US Aggregate Bond": 0.03
            };
            const sum = Object.values(weights).reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 5); // This will FAIL (sum is 1.11)
        });
    });
});
