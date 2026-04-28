// src/lib/logic/xray_risks.ts
import db from '../db/client';
import { getTickerMap } from '../db/prices';
import { resolveValue } from './xray';
import { PLACEMENT_PRIORITY } from './taxPlacement';
import { TaxEfficiencyTier, AccountType } from '../types/audit';
import { getHoldings } from './portfolioEngine';

export interface CanonicalExposure { name: string; tickers: string[]; totalValue: number; percentage: number; }

export function getCanonicalExposure(): CanonicalExposure[] {
    const holdings = getHoldings() as { ticker: string; quantity: number; market_value: number | null }[];
    const tickerMap = getTickerMap();
    const groups: Record<string, { tickers: Set<string>; value: number }> = {};
    let totalValue = 0;

    holdings.forEach(h => {
        const config = tickerMap[h.ticker] || { canonical: h.ticker, weights: {} };
        const v = resolveValue(h.ticker, h.quantity, h.market_value);
        if (v === null || v <= 0) return; // skip unpriced or zero value

        if (!groups[config.canonical]) groups[config.canonical] = { tickers: new Set(), value: 0 };
        groups[config.canonical].tickers.add(h.ticker);
        groups[config.canonical].value += v;
        totalValue += v;
    });

    return Object.entries(groups)
        .map(([name, data]) => ({
            name,
            tickers: Array.from(data.tickers),
            totalValue: data.value,
            percentage: data.value / (totalValue || 1)
        }))
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 10); // Only show top 10 exposures
}

export function getConcentrationRisks(): Array<{ ticker: string; name: string; percentage: number; value: number; rationale: string; isFundLookthrough: boolean }> {
    const allHoldings = getHoldings() as any[];
    
    // Group by ticker
    const holdings = Array.from(
        allHoldings.reduce((acc, h) => {
            if (!acc.has(h.ticker)) {
                acc.set(h.ticker, { ticker: h.ticker, quantity: 0, market_value: 0, asset_type: h.asset_type });
            }
            const existing = acc.get(h.ticker);
            existing.quantity += h.quantity || 0;
            existing.market_value += h.market_value || 0;
            return acc;
        }, new Map()).values()
    ) as { ticker: string; quantity: number; market_value: number | null; asset_type: string | null }[];

    const tickerMetadata = db.prepare(`SELECT ticker, name FROM ticker_meta`).all() as { ticker: string; name: string }[];
    const tickerValues: Record<string, number> = {};

    holdings.forEach(h => {
        const v = resolveValue(h.ticker, h.quantity, h.market_value);
        if (v !== null) tickerValues[h.ticker] = v;
    });

    const totalPortfolioValue = Object.values(tickerValues).reduce((acc, v) => acc + v, 0);
    if (totalPortfolioValue === 0) return [];

    // Calculate aggregate exposure including ETF look-through
    const aggregateExposure: Record<string, { direct: number; indirect: number }> = {};

    holdings.forEach(h => {
        const value = tickerValues[h.ticker] || 0;
        if (value <= 0) return;

        const isFund = h.asset_type === 'ETF' || h.asset_type === 'FUND' || h.asset_type === 'MUTUAL_FUND';

        // 1. Direct exposure — only for individual equities, not funds
        if (!isFund) {
            if (!aggregateExposure[h.ticker]) aggregateExposure[h.ticker] = { direct: 0, indirect: 0 };
            aggregateExposure[h.ticker].direct += value;
        }

        // 2. Indirect exposure (ETF look-through)
        try {
            const comps = db.prepare(`SELECT asset_ticker, weight FROM etf_composition WHERE fund_ticker = ?`).all(h.ticker) as { asset_ticker: string; weight: number }[];
            comps.forEach(c => {
                if (!aggregateExposure[c.asset_ticker]) aggregateExposure[c.asset_ticker] = { direct: 0, indirect: 0 };
                aggregateExposure[c.asset_ticker].indirect += value * c.weight;
            });
        } catch { /* table might not exist */ }
    });

    return Object.entries(aggregateExposure)
        .map(([ticker, data]) => {
            const total = data.direct + data.indirect;
            const meta = tickerMetadata.find(m => m.ticker === ticker);
            const name = meta?.name || ticker;
            const percentage = total / totalPortfolioValue;

            let rationale = "";
            if (data.direct > 0 && data.indirect > 0) {
                rationale = `Direct: $${(data.direct/1000).toFixed(1)}k, via ETF: $${(data.indirect/1000).toFixed(1)}k`;
            } else if (data.indirect > 0) {
                rationale = `Derived entirely from ETF holdings`;
            }

            return { ticker, name, percentage, value: total, rationale, isFundLookthrough: data.direct === 0 && data.indirect > 0 };
        })
        .filter(r => r.percentage > 0.05 && r.ticker !== 'CASH' && !r.ticker.includes('**'))
        .sort((a, b) => b.value - a.value);
}

export interface ExpenseRisk {
    currentTicker: string;
    currentEr: number;
    betterTicker: string;
    betterEr: number;
    savingsBps: number;
    potentialSavings: number;
}

export function getExpenseRisks(): ExpenseRisk[] {
    const allHoldings = getHoldings() as any[];
    const holdings = Array.from(
        allHoldings.reduce((acc, h) => {
            if (!acc.has(h.ticker)) {
                acc.set(h.ticker, { ticker: h.ticker, quantity: 0, market_value: 0 });
            }
            const existing = acc.get(h.ticker);
            existing.quantity += h.quantity || 0;
            existing.market_value += h.market_value || 0;
            return acc;
        }, new Map()).values()
    ) as { ticker: string; quantity: number; market_value: number | null }[];

    const tickerMap = getTickerMap();
    const metaList = db.prepare(`SELECT t.ticker, t.er, ar.custom_er FROM ticker_meta t LEFT JOIN asset_registry ar ON t.ticker = ar.ticker`).all() as Array<{ ticker: string, er: number | null, custom_er: number | null }>;

    const risks: ExpenseRisk[] = [];

    holdings.forEach(h => {
        const val = resolveValue(h.ticker, h.quantity, h.market_value);
        if (!val || val < 1000) return;

        const currentMeta = metaList.find(m => m.ticker === h.ticker);
        const currentEr = currentMeta?.custom_er ?? currentMeta?.er;
        if (currentEr == null) return;

        // Find primary category
        const config = tickerMap[h.ticker];
        if (!config) return;
        const primaryCat = Object.entries(config.weights).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!primaryCat) return;

        // Find cheaper alternative in same category
        let bestAlt: { ticker: string; er: number } | null = null;
        for (const [altTicker, altConfig] of Object.entries(tickerMap)) {
            if (altTicker === h.ticker) continue;
            if ((altConfig.weights[primaryCat] || 0) < 0.8) continue;
            const altMeta = metaList.find(m => m.ticker === altTicker);
            const altEr = altMeta?.custom_er ?? altMeta?.er;
            if (altEr == null) continue;
            if (altEr < currentEr && (!bestAlt || altEr < bestAlt.er)) {
                bestAlt = { ticker: altTicker, er: altEr };
            }
        }

        if (bestAlt && (currentEr - bestAlt.er) > 0.0005) { // At least 5bps savings
            risks.push({
                currentTicker: h.ticker,
                currentEr,
                betterTicker: bestAlt.ticker,
                betterEr: bestAlt.er,
                savingsBps: (currentEr - bestAlt.er) * 10000,
                potentialSavings: val * (currentEr - bestAlt.er)
            });
        }
    });

    return risks.sort((a, b) => b.potentialSavings - a.potentialSavings);
}

export interface TaxPlacementIssue {
    ticker: string;
    allocationLabel: string;
    tier: string;
    currentAccountType: AccountType;
    currentAccountName: string;
    preferredAccountType: AccountType;
    holdingValue: number;
    type: 'LEAKAGE' | 'OPTIMIZATION';
}

export function getTaxPlacementIssues(): TaxPlacementIssue[] {
    const holdings = getHoldings() as {
        ticker: string; market_value: number | null; quantity: number;
        tax_character: string; nickname: string; weights: string | null;
        account_id: string;
    }[];

    if (holdings.length === 0) return [];

    // Derive available account types from ALL accounts (not just those with holdings)
    const allAccounts = db.prepare(`SELECT DISTINCT tax_character FROM accounts`).all() as { tax_character: string }[];
    const availableTypes = allAccounts.map(a => a.tax_character as AccountType);

    const issues: TaxPlacementIssue[] = [];

    for (const row of holdings) {
        const weights = row.weights ? JSON.parse(row.weights) as Record<string, number> : {};
        // Determine primary allocation label by highest weight
        const primaryLabel = Object.entries(weights)
            .sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!primaryLabel) continue;

        const rule = PLACEMENT_PRIORITY[primaryLabel];
        if (!rule) continue; 

        // Only flag issues for assets that are actually inefficient (Tiers 1 & 2)
        if (rule.tier !== 'very_inefficient' && rule.tier !== 'inefficient') continue;

        const currentType = row.tax_character as AccountType;
        const preferredType = rule.priority.find(t => availableTypes.includes(t)) ?? currentType;

        // Skip if already in best available spot
        if (currentType === preferredType) continue;

        const holdingValue = resolveValue(row.ticker, row.quantity, row.market_value) ?? 0;
        if (holdingValue < 500) continue; // ignore tiny positions

        // CATEGORIZE:
        // LEAKAGE: In Taxable, belongs in Shelter (actual $ loss today)
        // OPTIMIZATION: In Deferred, belongs in Roth (long-term strategic uplift)
        const type = (currentType === 'TAXABLE') ? 'LEAKAGE' : 'OPTIMIZATION';

        issues.push({
            ticker: row.ticker,
            allocationLabel: primaryLabel,
            tier: rule.tier,
            currentAccountType: currentType,
            currentAccountName: row.nickname,
            preferredAccountType: preferredType,
            holdingValue,
            type,
        });
    }

    return issues.sort((a, b) => b.holdingValue - a.holdingValue);
}

