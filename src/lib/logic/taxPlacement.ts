// src/lib/logic/taxPlacement.ts
//
// Tax-efficient fund placement rules.
// Source: Bogleheads tax-efficient fund placement guide.
//
// Key principles:
//   - Very inefficient (REIT): ROTH > DEFERRED > TAXABLE
//     REIT income is non-qualified; tax-free growth beats deferral.
//   - Inefficient (bonds): DEFERRED > ROTH > TAXABLE
//     Bond interest is ordinary income — defer it.
//   - Moderately inefficient (small cap value, mid/small cap): DEFERRED > ROTH > TAXABLE
//     Higher yields + lower qualified dividend fraction than large-cap blend.
//   - Efficient (total market, large cap, international): TAXABLE > ROTH > DEFERRED
//     Low dividends mostly qualified; capital gains deferred until sale.
//     International gets foreign tax credit only in taxable accounts.
//
// Update this file when tax law changes warrant it. Changes are tracked in git.

export type AccountType = 'TAXABLE' | 'DEFERRED' | 'ROTH';
export type TaxEfficiencyTier = 'efficient' | 'moderately_inefficient' | 'inefficient' | 'very_inefficient';

interface PlacementRule {
    priority: AccountType[];
    tier: TaxEfficiencyTier;
}

export const PLACEMENT_PRIORITY: Record<string, PlacementRule> = {
    'REIT': { priority: ['ROTH', 'DEFERRED', 'TAXABLE'], tier: 'very_inefficient' },
    'US Aggregate Bond': { priority: ['DEFERRED', 'ROTH', 'TAXABLE'], tier: 'inefficient' },
    'Small Cap Value': { priority: ['DEFERRED', 'ROTH', 'TAXABLE'], tier: 'moderately_inefficient' },
    'Small-Cap': { priority: ['DEFERRED', 'ROTH', 'TAXABLE'], tier: 'moderately_inefficient' },
    'Mid-Cap': { priority: ['DEFERRED', 'ROTH', 'TAXABLE'], tier: 'moderately_inefficient' },
    'Developed Market': { priority: ['TAXABLE', 'ROTH', 'DEFERRED'], tier: 'efficient' },
    'Emerging Market': { priority: ['TAXABLE', 'ROTH', 'DEFERRED'], tier: 'efficient' },
    'Total Stock Market': { priority: ['TAXABLE', 'ROTH', 'DEFERRED'], tier: 'efficient' },
    'US Large Cap/SP500/DJIX': { priority: ['TAXABLE', 'ROTH', 'DEFERRED'], tier: 'efficient' },
};

const DEFAULT_RULE: PlacementRule = {
    priority: ['TAXABLE', 'ROTH', 'DEFERRED'],
    tier: 'efficient',
};

export function getTaxEfficiencyTier(label: string): TaxEfficiencyTier {
    return (PLACEMENT_PRIORITY[label] ?? DEFAULT_RULE).tier;
}

export function getPreferredTaxCharacter(
    label: string,
    availableTypes: AccountType[]
): AccountType {
    const rule = PLACEMENT_PRIORITY[label] ?? DEFAULT_RULE;
    for (const preferred of rule.priority) {
        if (availableTypes.includes(preferred)) return preferred;
    }
    return availableTypes[0];
}
