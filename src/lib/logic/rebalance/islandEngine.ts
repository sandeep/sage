
import db from '../../db/client';
import { calculateHierarchicalMetrics, MetricRow } from '../xray';
import { resolveTickerForCategory, Directive } from '../rebalancer';

export interface IslandCapacity {
    accountId: string;
    accountLabel: string;
    taxCharacter: 'TAXABLE' | 'ROTH' | 'DEFERRED';
    excess: Array<{ ticker: string; amount: number; costBasis?: number }>;
    shortfall: Array<{ assetClass: string; amount: number; targetTicker: string }>;
}

/**
 * PHASE 1: ISLAND STRATEGY MAPPING
 */
export function mapIslands(): IslandCapacity[] {
    const metrics = calculateHierarchicalMetrics();
    const totalPortfolioValue = metrics.find(m => m.label === 'Total Portfolio')?.actualValue || 0;
    
    if (totalPortfolioValue === 0) return [];

    const allAccounts = db.prepare('SELECT id, nickname, tax_character, provider FROM accounts').all() as any[];
    
    return allAccounts.map(acc => {
        const accountId = acc.id;
        const accountLabel = `${acc.provider} ${acc.nickname || acc.id}`;
        
        const physicalHoldings = db.prepare(`
            SELECT ticker, SUM(market_value) as value, SUM(cost_basis) as cost_basis
            FROM holdings_ledger
            WHERE account_id = ? AND snapshot_date = (SELECT MAX(snapshot_date) FROM holdings_ledger)
            GROUP BY ticker
        `).all(accountId) as any[];

        // 1. Determine local "Excess"
        // Heuristic: If global category is overweight, local positions in that category are candidates.
        const excess: IslandCapacity['excess'] = [];
        physicalHoldings.forEach(h => {
            const ticker = h.ticker;
            const value = h.value || 0;
            if (value <= 0) return;

            // Simple "Overweight" Check:
            // Find which category this ticker belongs to
            const asset = db.prepare("SELECT weights FROM asset_registry WHERE ticker = ?").get(ticker) as { weights: string } | undefined;
            if (!asset) return;
            const weights = JSON.parse(asset.weights);
            const primaryCategory = Object.keys(weights)[0];
            
            const categoryMetric = metrics.find(m => m.label === primaryCategory);
            const globalDelta = categoryMetric ? (categoryMetric.actualValue - (categoryMetric.expectedPortfolio * totalPortfolioValue)) : 0;

            if (globalDelta > 500 || primaryCategory === 'Cash' || ticker === 'CASH') {
                excess.push({
                    ticker,
                    amount: Math.min(value, Math.max(0, globalDelta)),
                    costBasis: h.cost_basis
                });
            }
        });

        // 2. Determine local "Shortfall" capability
        const shortfall: IslandCapacity['shortfall'] = [];
        metrics.filter(m => m.level === 2).forEach(m => {
            const globalDelta = (m.expectedPortfolio * totalPortfolioValue) - m.actualValue;
            if (globalDelta > 1000) {
                shortfall.push({
                    assetClass: m.label,
                    amount: globalDelta,
                    targetTicker: resolveTickerForCategory(m.label, acc.provider)
                });
            }
        });

        return {
            accountId,
            accountLabel,
            taxCharacter: acc.tax_character,
            excess: excess.sort((a, b) => b.amount - a.amount),
            shortfall: shortfall.sort((a, b) => b.amount - a.amount)
        };
    }).filter(island => island.excess.length > 0 || island.shortfall.length > 0);
}

/**
 * PHASE 2: ATOMIC SWAP SOLVER
 * Executes intra-island trades while respecting tax-character constraints.
 */
export function solveIslands(islands: IslandCapacity[]): Directive[] {
    const directives: Directive[] = [];
    const MAX_GAIN_THRESHOLD = 500;

    for (const island of islands) {
        let islandShortfallTotal = island.shortfall.reduce((s, v) => s + v.amount, 0);
        
        // 1. Filter Excess by Tax Liability (Taxable Only)
        const sellableExcess = island.excess.filter(e => {
            if (island.taxCharacter !== 'TAXABLE') return true;
            const gain = e.amount - (e.costBasis || 0);
            return gain <= MAX_GAIN_THRESHOLD;
        });

        // 2. Atomic Swap Loop
        for (const over of sellableExcess) {
            for (const under of island.shortfall) {
                if (over.amount <= 0 || under.amount <= 0) continue;

                const swapAmount = Math.min(over.amount, under.amount);
                if (swapAmount < 1000) continue;

                directives.push({
                    type: 'REBALANCE',
                    description: `Swap $${(swapAmount / 1000).toFixed(1)}k ${over.ticker} → ${under.assetClass} (${under.targetTicker}) in ${island.accountLabel}`,
                    priority: swapAmount > 10000 ? 'HIGH' : 'MEDIUM',
                    reasoning: `Intra-island atomic swap: funding ${under.assetClass} shortfall using excess ${over.ticker} liquidity.`,
                    link_key: under.targetTicker,
                    account_id: island.accountId,
                    asset_class: under.assetClass,
                    amount: swapAmount
                });

                over.amount -= swapAmount;
                under.amount -= swapAmount;
            }

            // 3. Targeted Liquidation (Residual to Cash)
            if (over.amount > 1000) {
                directives.push({
                    type: 'SELL',
                    description: `Trim $${(over.amount / 1000).toFixed(1)}k ${over.ticker} (Move to Cash) in ${island.accountLabel}`,
                    priority: over.amount > 10000 ? 'HIGH' : 'LOW',
                    reasoning: `Tax-aware liquidation: re-balancing overweight ${over.ticker} to core cash reserves.`,
                    link_key: over.ticker,
                    account_id: island.accountId,
                    amount: over.amount
                });
            }
        }
    }

    return directives;
}
