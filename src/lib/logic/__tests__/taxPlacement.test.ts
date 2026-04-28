import { describe, it, expect } from 'vitest';
import { getPreferredTaxCharacter, getTaxEfficiencyTier, PLACEMENT_PRIORITY } from '../taxPlacement';

describe('getTaxEfficiencyTier', () => {
    it('marks total stock market as efficient', () => {
        expect(getTaxEfficiencyTier('Total Stock Market')).toBe('efficient');
    });
    it('marks international as efficient (foreign tax credit)', () => {
        expect(getTaxEfficiencyTier('Developed Market')).toBe('efficient');
        expect(getTaxEfficiencyTier('Emerging Market')).toBe('efficient');
    });
    it('marks small cap value as moderately_inefficient', () => {
        expect(getTaxEfficiencyTier('Small Cap Value')).toBe('moderately_inefficient');
    });
    it('marks REIT as very_inefficient', () => {
        expect(getTaxEfficiencyTier('REIT')).toBe('very_inefficient');
    });
    it('marks bonds as inefficient', () => {
        expect(getTaxEfficiencyTier('US Aggregate Bond')).toBe('inefficient');
    });
    it('defaults unknown labels to efficient (place anywhere)', () => {
        expect(getTaxEfficiencyTier('Unknown Asset Class')).toBe('efficient');
    });
});

describe('getPreferredTaxCharacter', () => {
    it('returns TAXABLE first for efficient assets', () => {
        expect(getPreferredTaxCharacter('Total Stock Market', ['TAXABLE', 'DEFERRED', 'ROTH'])).toBe('TAXABLE');
    });
    it('returns DEFERRED first for bond funds', () => {
        expect(getPreferredTaxCharacter('US Aggregate Bond', ['TAXABLE', 'DEFERRED', 'ROTH'])).toBe('DEFERRED');
    });
    it('returns ROTH first for REIT', () => {
        expect(getPreferredTaxCharacter('REIT', ['TAXABLE', 'DEFERRED', 'ROTH'])).toBe('ROTH');
    });
    it('falls back to DEFERRED for REIT when ROTH unavailable', () => {
        expect(getPreferredTaxCharacter('REIT', ['TAXABLE', 'DEFERRED'])).toBe('DEFERRED');
    });
    it('falls back to ROTH for bonds when DEFERRED unavailable', () => {
        expect(getPreferredTaxCharacter('US Aggregate Bond', ['TAXABLE', 'ROTH'])).toBe('ROTH');
    });
    it('falls back to TAXABLE when no preferred account type available', () => {
        expect(getPreferredTaxCharacter('US Aggregate Bond', ['TAXABLE'])).toBe('TAXABLE');
    });
    it('returns DEFERRED first for small cap value', () => {
        expect(getPreferredTaxCharacter('Small Cap Value', ['TAXABLE', 'DEFERRED', 'ROTH'])).toBe('DEFERRED');
    });
});

describe('PLACEMENT_PRIORITY', () => {
    it('has an entry for every known allocation label', () => {
        const knownLabels = [
            'Total Stock Market', 'US Large Cap/SP500/DJIX', 'Small Cap Value',
            'REIT', 'Mid-Cap', 'Small-Cap', 'Developed Market', 'Emerging Market',
            'US Aggregate Bond',
        ];
        knownLabels.forEach(label => {
            expect(PLACEMENT_PRIORITY[label]).toBeDefined();
            expect(PLACEMENT_PRIORITY[label].priority.length).toBeGreaterThan(0);
        });
    });
});
