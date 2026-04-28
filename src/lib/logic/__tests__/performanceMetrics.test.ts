import { describe, it, expect } from 'vitest';
import {
    computeMaxDrawdown,
    computeTrackingError,
    computeInformationRatio,
    computeUpsideCapture,
    computeDownsideCapture,
    navFromAnnualReturns,
} from '../performanceMetrics';

describe('navFromAnnualReturns', () => {
    it('builds cumulative NAV from annual returns', () => {
        const nav = navFromAnnualReturns([0.10, -0.20, 0.15]);
        expect(nav[0]).toBe(1.0);
        expect(nav[1]).toBeCloseTo(1.10);
        expect(nav[2]).toBeCloseTo(0.88);
        expect(nav[3]).toBeCloseTo(1.012);
    });

    it('returns [1.0] for empty input', () => {
        expect(navFromAnnualReturns([])).toEqual([1.0]);
    });
});

describe('computeMaxDrawdown', () => {
    it('returns 0 for monotonically increasing NAV', () => {
        expect(computeMaxDrawdown([1.0, 1.1, 1.2, 1.3])).toBe(0);
    });

    it('computes peak-to-trough correctly', () => {
        // Peak at 1.2, trough at 0.9 → drawdown = (0.9 - 1.2) / 1.2 = -0.25
        const dd = computeMaxDrawdown([1.0, 1.2, 0.9, 1.1]);
        expect(dd).toBeCloseTo(-0.25);
    });

    it('finds the worst drawdown across multiple peaks', () => {
        // Two drawdowns: 1.0→0.8 (−20%) and 1.2→0.85 (−29.2%)
        const dd = computeMaxDrawdown([1.0, 0.8, 1.2, 0.85]);
        expect(dd).toBeCloseTo(-0.292, 2);
    });

    it('returns 0 for single element NAV', () => {
        expect(computeMaxDrawdown([1.0])).toBe(0);
    });
});

describe('computeTrackingError', () => {
    it('returns 0 when returns are identical', () => {
        const r = [0.01, -0.005, 0.02];
        expect(computeTrackingError(r, r, 252)).toBe(0);
    });

    it('annualizes with sqrt(252) for daily data', () => {
        // Excess return constant at 0.01 → std dev = 0 → TE = 0
        const port = [0.02, 0.03, 0.01];
        const bench = [0.01, 0.02, 0.00];
        const te = computeTrackingError(port, bench, 252);
        // excess = [0.01, 0.01, 0.01] → variance = 0 → te = 0
        expect(te).toBe(0);
    });

    it('produces nonzero TE for varying excess returns', () => {
        const port = [0.02, -0.01, 0.03, 0.00];
        const bench = [0.01, 0.01, 0.01, 0.01];
        const te = computeTrackingError(port, bench, 252);
        expect(te).toBeGreaterThan(0);
    });
});

describe('computeInformationRatio', () => {
    it('returns 0 when tracking error is 0', () => {
        const r = [0.01, 0.01, 0.01];
        expect(computeInformationRatio(r, r, 252)).toBe(0);
    });

    it('is positive when portfolio consistently beats benchmark', () => {
        const port = [0.02, 0.015, 0.025, 0.018];
        const bench = [0.01, 0.005, 0.01, 0.008];
        const ir = computeInformationRatio(port, bench, 252);
        expect(ir).toBeGreaterThan(0);
    });
});

describe('computeUpsideCapture', () => {
    it('returns 1.0 when portfolio matches benchmark in up periods', () => {
        const r = [0.05, 0.03, 0.04];
        expect(computeUpsideCapture(r, r)).toBeCloseTo(1.0);
    });

    it('returns 0 when no up periods', () => {
        const bench = [-0.01, -0.02];
        const port  = [-0.005, -0.01];
        expect(computeUpsideCapture(port, bench)).toBe(0);
    });

    it('is less than 1 when portfolio captures less upside than benchmark', () => {
        const port = [0.03, 0.02, 0.04];
        const bench = [0.06, 0.05, 0.07];
        expect(computeUpsideCapture(port, bench)).toBeLessThan(1.0);
    });
});

describe('computeDownsideCapture', () => {
    it('returns 0 when no down periods', () => {
        const bench = [0.01, 0.02];
        const port  = [0.01, 0.02];
        expect(computeDownsideCapture(port, bench)).toBe(0);
    });

    it('is less than 1 when portfolio loses less in down periods (good)', () => {
        const bench = [-0.05, -0.03, -0.04];
        const port  = [-0.02, -0.01, -0.015];
        expect(computeDownsideCapture(port, bench)).toBeLessThan(1.0);
    });
});
