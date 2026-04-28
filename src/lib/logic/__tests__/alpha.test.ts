// src/lib/logic/__tests__/alpha.test.ts
import { describe, it, expect } from 'vitest';
import { calculateSharpeRatio, calculateSortinoRatio, calculateCorrelation } from '../alpha';

describe('alpha', () => {
    it('calculateSharpeRatio works correctly', () => {
        const returns = [0.1, 0.2, -0.05, 0.08, 0.12];
        const ratio = calculateSharpeRatio(returns, 0.05);
        expect(ratio).toBeGreaterThan(0);
    });

    it('calculateSortinoRatio works correctly', () => {
        const returns = [0.1, 0.2, -0.05, 0.08, 0.12];
        const ratio = calculateSortinoRatio(returns, 0.05);
        expect(ratio).toBeGreaterThan(0);
        expect(isFinite(ratio)).toBe(true);
    });

    it('calculateSortinoRatio is sensitive to downside period count, not total period count', () => {
        // Same downside returns, but different number of upside periods.
        // Bug: dividing by total returns.length inflates the denominator and
        // produces a lower (artificially distorted) ratio when more upside
        // periods are added. Fixed: divides by downsideReturns.length only.
        const riskFreeRate = 0.05;
        // One upside period + one downside period
        const fewPeriods = [0.15, -0.10];
        // Many upside periods + same one downside period
        const manyPeriods = [0.15, 0.20, 0.18, 0.22, 0.17, -0.10];

        const ratioFew = calculateSortinoRatio(fewPeriods, riskFreeRate);
        const ratioMany = calculateSortinoRatio(manyPeriods, riskFreeRate);

        // With the fix, downside std dev is identical in both cases (same
        // single downside return), so the ratios should differ only due to
        // the different mean returns — not due to a diluted denominator.
        expect(isFinite(ratioFew)).toBe(true);
        expect(isFinite(ratioMany)).toBe(true);

        // Manually compute expected values to confirm correct denominator
        const downsideDeviation = Math.sqrt(Math.pow(-0.10 - riskFreeRate, 2) / 1);
        const expectedFew = (fewPeriods.reduce((a, b) => a + b) / fewPeriods.length - riskFreeRate) / downsideDeviation;
        const expectedMany = (manyPeriods.reduce((a, b) => a + b) / manyPeriods.length - riskFreeRate) / downsideDeviation;

        expect(ratioFew).toBeCloseTo(expectedFew, 10);
        expect(ratioMany).toBeCloseTo(expectedMany, 10);
    });

    it('calculateSortinoRatio returns 0 when no downside periods exist', () => {
        const allPositive = [0.10, 0.20, 0.15];
        expect(calculateSortinoRatio(allPositive, 0.05)).toBe(0);
    });

    it('calculateCorrelation works correctly', () => {
        const returnsA = [0.1, 0.2, -0.05, 0.08, 0.12];
        const returnsB = [0.08, 0.18, -0.06, 0.07, 0.11]; // Highly correlated
        const correlation = calculateCorrelation(returnsA, returnsB);
        expect(correlation).toBeGreaterThan(0.9);
    });
});
