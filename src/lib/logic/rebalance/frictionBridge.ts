
import { IdealPortfolioMap } from './idealMap';
import { Directive, resolveTickerForCategory } from '../rebalancer';
import db from '../../db/client';

import { getStrategicSettings } from '../../db/settings';

export interface ActualHoldingsMap {
    [accountId: string]: {
        [ticker: string]: {
            quantity: number;
            value: number;
        }
    }
}

function resolveCategoryForTicker(ticker: string): string {
    const asset = db.prepare("SELECT weights FROM asset_registry WHERE ticker = ?").get(ticker) as { weights: string } | undefined;
    if (!asset) return ticker;
    try {
        const weights = JSON.parse(asset.weights);
        const categories = Object.keys(weights);
        return categories.length > 0 ? categories[0] : ticker;
    } catch {
        return ticker;
    }
}

function splitIntoTranches(directive: Omit<Directive, 'tranche_index' | 'tranche_total'>, totalAmount: number): Directive[] {
    const settings = getStrategicSettings();
    const maxSize = settings.max_tranche_size || 20000;
    
    const count = Math.ceil(totalAmount / maxSize);
    if (count <= 1) return [{ ...directive, tranche_index: 1, tranche_total: 1 }];
    
    const baseAmount = Math.floor(totalAmount / count);
    const remainder = totalAmount - baseAmount * count;

    return Array.from({ length: count }, (_, i) => {
        const amount = baseAmount + (i === count - 1 ? remainder : 0);
        const amountK = (amount / 1000).toFixed(1);
        const description = directive.description.replace(/\$[\d.]+k/, `$${amountK}k`);
        return {
            ...directive,
            description,
            amount,
            tranche_index: i + 1,
            tranche_total: count,
        };
    });
}

export function generateReconciliationTrades(
    idealMap: IdealPortfolioMap,
    actualMap: ActualHoldingsMap,
    accountMeta: Map<string, { label: string; provider: string }>
): Directive[] {
    const directives: Directive[] = [];
    const MIN_TRADE_SIZE = 1000;

    for (const [accountId, idealHoldings] of Object.entries(idealMap)) {
        const actualHoldings = actualMap[accountId] || {};
        const meta = accountMeta.get(accountId) || { label: accountId, provider: 'UNKNOWN' };

        const overweights: { ticker: string; amount: number }[] = [];
        const underweights: { ticker: string; amount: number }[] = [];

        const allTickers = new Set([...Object.keys(idealHoldings), ...Object.keys(actualHoldings)]);

        for (const ticker of allTickers) {
            const ideal = idealHoldings[ticker] || 0;
            const actual = actualHoldings[ticker]?.value || 0;
            const delta = actual - ideal;

            if (delta > MIN_TRADE_SIZE) {
                overweights.push({ ticker, amount: delta });
            } else if (delta < -MIN_TRADE_SIZE) {
                underweights.push({ ticker, amount: Math.abs(delta) });
            }
        }

        // Internal Swaps (Zero Friction)
        while (overweights.length > 0 && underweights.length > 0) {
            const over = overweights[0];
            const under = underweights[0];
            const swapAmount = Math.min(over.amount, under.amount);
            const category = resolveCategoryForTicker(under.ticker);
            const targetTicker = resolveTickerForCategory(category, meta.provider);

            const base: Omit<Directive, 'tranche_index' | 'tranche_total'> = {
                type: 'REBALANCE',
                description: `Swap $${(swapAmount / 1000).toFixed(1)}k ${over.ticker} → ${category} (${targetTicker}) in ${meta.label}`,
                priority: swapAmount > 10000 ? 'HIGH' : 'MEDIUM',
                reasoning: `Internal account reconciliation: trimming excess ${over.ticker} to fund missing ${category} in ${meta.label}`,
                link_key: targetTicker,
                account_id: accountId,
                asset_class: category,
                amount: swapAmount,
            };
            directives.push(...splitIntoTranches(base, swapAmount));

            over.amount -= swapAmount;
            under.amount -= swapAmount;
            if (over.amount < MIN_TRADE_SIZE) overweights.shift();
            if (under.amount < MIN_TRADE_SIZE) underweights.shift();
        }

        // Stand-alone Trims
        for (const over of overweights) {
            const base: Omit<Directive, 'tranche_index' | 'tranche_total'> = {
                type: 'SELL',
                description: `Trim $${(over.amount / 1000).toFixed(1)}k ${over.ticker} in ${meta.label}`,
                priority: over.amount > 10000 ? 'HIGH' : 'LOW',
                reasoning: `Overweight position in ${meta.label} relative to target-state blueprint.`,
                link_key: over.ticker,
                account_id: accountId,
                asset_class: resolveCategoryForTicker(over.ticker),
                amount: over.amount,
            };
            directives.push(...splitIntoTranches(base, over.amount));
        }

        // Stand-alone Buys
        for (const under of underweights) {
            const category = resolveCategoryForTicker(under.ticker);
            const targetTicker = resolveTickerForCategory(category, meta.provider);
            const base: Omit<Directive, 'tranche_index' | 'tranche_total'> = {
                type: 'BUY',
                description: `Buy $${(under.amount / 1000).toFixed(1)}k ${category} (${targetTicker}) in ${meta.label}`,
                priority: under.amount > 10000 ? 'HIGH' : 'LOW',
                reasoning: `Underweight position in ${meta.label} relative to target-state blueprint.`,
                link_key: targetTicker,
                account_id: accountId,
                asset_class: category,
                amount: under.amount,
            };
            directives.push(...splitIntoTranches(base, under.amount));
        }
    }

    return directives;
}
