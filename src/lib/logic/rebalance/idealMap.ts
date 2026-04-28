
import { AccountType, PLACEMENT_PRIORITY } from '../taxPlacement';

export interface AccountCapacity {
    id: string;
    type: AccountType;
    totalValue: number;
}

export interface IdealPortfolioMap {
    [accountId: string]: {
        [ticker: string]: number; // Target dollar amount
    }
}

/**
 * PHASE 1: THE IDEAL MAP (The Blueprint)
 * Distributes target strategy dollars across specific account types 
 * using a hierarchical tax-efficiency waterfall.
 * @param priorities Optional override for tax placement rules (useful for testing)
 */
export function generateIdealMap(
    totalValue: number,
    targetWeights: Record<string, number>,
    accounts: AccountCapacity[],
    priorities: any = PLACEMENT_PRIORITY
): IdealPortfolioMap {
    const idealMap: IdealPortfolioMap = {};
    accounts.forEach(acc => idealMap[acc.id] = {});

    // 1. Group targets into Efficiency Tiers
    const sortedAssets = Object.entries(targetWeights)
        .map(([ticker, weight]) => ({ ticker, dollars: weight * totalValue }))
        .sort((a, b) => {
            const getScore = (ticker: string) => {
                const rule = priorities[ticker];
                if (!rule) return 0;
                if (rule.priority[0] === 'ROTH') return 2;
                if (rule.priority[0] === 'DEFERRED') return 1;
                return 0;
            };
            return getScore(b.ticker) - getScore(a.ticker);
        });

    // 2. Greedy Fill by Account Type Priority
    const capacities = accounts.map(a => ({ ...a, remaining: a.totalValue }));
    
    for (const asset of sortedAssets) {
        let remainingToPlace = asset.dollars;

        // Try to place in Preferred accounts first
        const rule = priorities[asset.ticker] || { priority: ['TAXABLE', 'ROTH', 'DEFERRED'] };
        
        for (const preferredType of rule.priority) {
            const matchingAccounts = capacities.filter(c => c.type === preferredType && c.remaining > 0);
            
            for (const acc of matchingAccounts) {
                const amount = Math.min(remainingToPlace, acc.remaining);
                if (amount <= 0) continue;

                idealMap[acc.id][asset.ticker] = (idealMap[acc.id][asset.ticker] || 0) + amount;
                acc.remaining -= amount;
                remainingToPlace -= amount;

                if (remainingToPlace <= 0.01) break;
            }
            if (remainingToPlace <= 0.01) break;
        }
    }

    return idealMap;
}
