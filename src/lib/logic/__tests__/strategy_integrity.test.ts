
import { describe, it, expect } from 'vitest';
import { redistributeExcludedWeights } from '../allocationSimulator';

describe('Financial Engine: Strategy Integrity Safeguards', () => {
    
    it('prevents silent normalization when weights do not sum to 100%', () => {
        const brokenWeights = { "Total Stock Market": 0.80, "Small Cap Value": 0.40 }; // Sum = 1.20
        const mappedLabels = ["Total Stock Market", "Small Cap Value"];
        
        // Before the fix, this would have returned {TSM: 0.66, SCV: 0.33}
        const result = redistributeExcludedWeights(brokenWeights, mappedLabels);
        
        // NOW: The 'adjusted' weights should match the original broken inputs (0.8 and 0.4)
        // rather than being normalized to 1.0. 
        // This 'passes the buck' of the error to the calling function rather than hiding it.
        expect(result.adjusted["Total Stock Market"]).toBe(0.80);
        expect(result.adjusted["Small Cap Value"]).toBe(0.40);
        
        const total = Object.values(result.adjusted).reduce((a, b) => a + b, 0);
        expect(total).toBeCloseTo(1.20, 5);
    });

    it('correctly handles perfect 100% allocations', () => {
        const validWeights = { "Total Stock Market": 0.60, "Small Cap Value": 0.40 };
        const mappedLabels = ["Total Stock Market", "Small Cap Value"];
        
        const result = redistributeExcludedWeights(validWeights, mappedLabels);
        expect(result.adjusted["Total Stock Market"]).toBe(0.60);
        expect(result.adjusted["Small Cap Value"]).toBe(0.40);
        
        const total = Object.values(result.adjusted).reduce((a, b) => a + b, 0);
        expect(total).toBe(1.0);
    });

    it('redistributes correctly ONLY when an exclusion happens', () => {
        // Here, Gold is excluded (0.1). We have 0.9 left.
        // We do NOT want to normalize that 0.9 to 1.0 anymore. 
        // We want the engine to see that 10% of the portfolio is 'missing' from the simulation.
        const weights = { "TSM": 0.90, "GOLD": 0.10 };
        const mapped = ["TSM"];
        
        const result = redistributeExcludedWeights(weights, mapped);
        
        expect(result.adjusted["TSM"]).toBe(0.90);
        expect(result.excluded).toContain("GOLD");
        expect(result.excludedWeight).toBe(0.10);
    });
});
