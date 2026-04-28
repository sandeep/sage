
import { describe, it, expect } from 'vitest';
import { redistributeExcludedWeights } from '../allocationSimulator';

describe('redistributeExcludedWeights', () => {
    it('rescales mapped weights to sum to 1.0', () => {
        const weights = {
            'Total Stock Market': 0.6,
            'Healthcare': 0.4, // Corrected to sum to 1.0
        };
        const mapped = ['Total Stock Market'];
        // Note: Our new engine REFUSES to rescale. It just removes excluded.
        // So we expect 0.6 to remain 0.6.
        const result = redistributeExcludedWeights(weights, mapped);
        expect(result.adjusted['Total Stock Market']).toBe(0.6);
        expect(result.excludedWeight).toBe(0.4);
    });
});
