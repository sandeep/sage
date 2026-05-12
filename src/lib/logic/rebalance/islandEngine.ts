
import db from '../../db/client';
import { calculateHierarchicalMetrics, MetricRow } from '../xray';
import { Directive } from '../rebalancer';
import { resolveInstrument } from '../instrumentResolver';

export interface IslandCapacity {
    accountId: string;
    accountLabel: string;
    taxCharacter: 'TAXABLE' | 'ROTH' | 'DEFERRED';
    excess: Array<{ ticker: string; amount: number; assetClass: string; costBasis?: number }>;
    shortfall: Array<{ assetClass: string; amount: number; targetTicker: string }>;
}

/**
 * PHASE 1: ISLAND STRATEGY MAPPING
 */
export function mapIslands(): IslandCapacity[] {
    const metrics = calculateHierarchicalMetrics();
    const totalPortfolioValue = metrics.find(m => m.label === 'Total Portfolio')?.actualValue || 0;
    
    if (totalPortfolioValue === 0) return [];

    // Optimization: Map metrics for O(1) lookup
    const metricMap = new Map<string, MetricRow>();
    metrics.forEach(m => metricMap.set(m.label, m));

    const allAccounts = db.prepare('SELECT id, nickname, tax_character, provider FROM accounts').all() as any[];
    
    // Optimization: Batch fetch holdings for all accounts
    const allCurrentHoldings = db.prepare(`
        SELECT account_id, ticker, SUM(market_value) as value, SUM(cost_basis) as cost_basis
        FROM holdings_ledger
        WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM holdings_ledger)
        GROUP BY account_id, ticker
    `).all() as any[];

    // Optimization: Batch fetch asset registry weights
    const uniqueTickers = Array.from(new Set(allCurrentHoldings.map(h => h.ticker)));
    const weightMap = new Map<string, Record<string, number>>();
    if (uniqueTickers.length > 0) {
        const placeholders = uniqueTickers.map(() => '?').join(',');
        const rows = db.prepare(`SELECT ticker, weights FROM asset_registry WHERE ticker IN (${placeholders})`).all(...uniqueTickers) as any[];
        rows.forEach(r => {
            try {
                weightMap.set(r.ticker, JSON.parse(r.weights));
            } catch (e) {
                // Silently ignore parsing errors
            }
        });
    }

    const shortfallMetrics = metrics.filter(m => m.level === 2);
    
    return allAccounts.map(acc => {
        const accountId = acc.id;
        const accountLabel = `${acc.provider} ${acc.nickname || acc.id}`;
        
        const accountHoldings = allCurrentHoldings.filter(h => h.account_id === accountId);

        // 1. Determine local "Excess"
        const excess: IslandCapacity['excess'] = [];
        accountHoldings.forEach(h => {
            const ticker = h.ticker;
            const value = h.value || 0;
            if (value <= 0) return;

            const weights = weightMap.get(ticker);
            const isCash = ticker.toUpperCase() === 'CASH';
            if (!weights && !isCash) return;
            
            // REFINED LOGIC: Calculate NET effect
            // A fund is "Excess" if its aggregate constituent delta is positive (net overweight)
            let netDelta = 0;
            let primaryAssetClass = 'Unknown';

            if (isCash) {
                primaryAssetClass = 'Cash';
                const m = metricMap.get('Cash');
                netDelta = m ? (m.actualValue - (m.expectedPortfolio * totalPortfolioValue)) : value;
            } else if (weights) {
                let maxWeight = -1;
                for (const [category, weight] of Object.entries(weights)) {
                    const w = weight as number;
                    if (w > maxWeight) {
                        maxWeight = w;
                        primaryAssetClass = category;
                    }
                    const m = metricMap.get(category);
                    const globalDelta = m ? (m.actualValue - (m.expectedPortfolio * totalPortfolioValue)) : 0;
                    netDelta += w * globalDelta;
                }
            }

            if (netDelta > 500 || isCash) {
                excess.push({
                    ticker,
                    amount: Math.min(value, Math.max(0, netDelta)),
                    assetClass: primaryAssetClass,
                    costBasis: h.cost_basis
                });
            }
        });

        // 2. Determine local "Shortfall" capability
        const shortfall: IslandCapacity['shortfall'] = [];
        shortfallMetrics.forEach(m => {
            const globalDelta = (m.expectedPortfolio * totalPortfolioValue) - m.actualValue;
            if (globalDelta > 1000) {
                const resolution = resolveInstrument(accountId, m.label);
                shortfall.push({
                    assetClass: m.label,
                    amount: globalDelta,
                    targetTicker: resolution.ticker
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
                    amount: swapAmount,
                    source_ticker: over.ticker,
                    target_ticker: under.targetTicker,
                    source_asset_class: over.assetClass,
                    target_asset_class: under.assetClass
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
                    amount: over.amount,
                    source_ticker: over.ticker,
                    target_ticker: 'CASH',
                    source_asset_class: over.assetClass,
                    target_asset_class: 'Cash'
                });
            }
        }
    }

    return directives;
}
