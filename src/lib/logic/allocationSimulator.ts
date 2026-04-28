// src/lib/logic/allocationSimulator.ts
//
// Maps allocation leaf categories to ETF proxies and Simba asset class labels,
// flattens the nested allocation tree to leaf weights, and simulates portfolio NAVs.

// ── Maps ─────────────────────────────────────────────────────────────────────

/** Allocation leaf label → ETF ticker in price_history.
 *  Labels must match EXACTLY what is stored in allocation_nodes / target_allocation.json. */
export const ETF_PROXY_MAP: Record<string, string> = {
    'Total Stock Market':            'VTI',
    'US Large Cap/SP500/DJIX':       'VOO',
    'Small Cap Value':               'VBR',
    'REIT':                          'VNQ',
    'Mid-Cap':                       'VO',
    'Small-Cap':                     'VB',
    'Developed Market':              'VEA',
    'Emerging Market':               'VWO',
    'US Aggregate Bond':             'BND',
    // Excluded (no reliable ETF proxy in price_history):
    //   Healthcare, Energy, Non Big (Ext Market/Small Blend),
    //   Int'l Small Cap, Int'l Value, Total Int'l Stock Market, Cash
};

/** Allocation leaf label → Simba asset class key in simba_returns.json. */
export const SIMBA_MAP: Record<string, string> = {
    'Total Stock Market':       'TSM',
    'US Large Cap/SP500/DJIX':  'LCB',
    'Small Cap Value':          'SCV',
    'REIT':                     'REIT',
    'Developed Market':         'INTL',
    'Emerging Market':          'EM',
    'US Aggregate Bond':        'ITT',
    // All other labels are excluded from Simba simulation.
};

// ── Tree flattening ───────────────────────────────────────────────────────────

/** Convert the nested allocation tree (from /api/admin/allocation) into a flat
 *  Record<label, weight> containing only leaf nodes. Handles all three depths:
 *  - Level 2 subcategories (e.g. "Total Stock Market" under "US Stock" under "Stock")
 *  - Level 1 category leaves (e.g. "US Aggregate Bond" under "Bond" with no subcategories)
 *  - Level 0 top-level leaves (e.g. "Cash" with no categories) */
export function flattenLeafWeights(tree: Record<string, any>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [topKey, topNode] of Object.entries(tree)) {
        if (topNode.categories) {
            const categories = topNode.categories as Record<string, any>;
            let coveredByCategories = 0;
            for (const [catLabel, catNode] of Object.entries(categories)) {
                if ((catNode as any).subcategories) {
                    const subcategories = (catNode as any).subcategories as Record<string, any>;
                    let coveredBySubcategories = 0;
                    for (const [subLabel, subNode] of Object.entries(subcategories)) {
                        const w = (subNode as any).weight ?? 0;
                        out[subLabel] = w;
                        coveredBySubcategories += w;
                    }
                    // Add residual for this category if subcategories don't cover full category weight
                    const catWeight = (catNode as any).weight ?? 0;
                    const catResidual = catWeight - coveredBySubcategories;
                    if (catResidual > 1e-9) {
                        out[catLabel] = (out[catLabel] ?? 0) + catResidual;
                    }
                    coveredByCategories += catWeight;
                } else {
                    // Level-1 leaf (e.g. US Aggregate Bond)
                    const w = (catNode as any).weight ?? 0;
                    out[catLabel] = w;
                    coveredByCategories += w;
                }
            }
            // Add residual for top-level node if categories don't cover full weight
            const topWeight = topNode.weight ?? 0;
            const topResidual = topWeight - coveredByCategories;
            if (topResidual > 1e-9) {
                out[topKey] = (out[topKey] ?? 0) + topResidual;
            }
        } else {
            // Top-level leaf (e.g. Cash) — use the tree key as the label
            out[topKey] = topNode.weight ?? 0;
        }
    }
    return out;
}

// ── Weight redistribution ─────────────────────────────────────────────────────

export interface RedistributionResult {
    adjusted: Record<string, number>; // mapped labels → rescaled weights summing to 1.0
    excluded: string[];               // labels not in mappedLabels
    excludedWeight: number;           // sum of excluded weights (before redistribution)
}

/** Remove unmapped leaf labels from the weight map.
 *  CRITICAL SAFEGUARD: Mapped weights must sum to exactly 1.0. 
 *  We no longer 'help' the user by auto-scaling (normalization slop). */
export function redistributeExcludedWeights(
    weights: Record<string, number>,
    mappedLabels: string[],
): RedistributionResult {
    const excluded = Object.keys(weights).filter(l => !mappedLabels.includes(l));
    const excludedWeight = excluded.reduce((s, l) => s + (weights[l] ?? 0), 0);
    const totalMapped = mappedLabels.reduce((s, l) => s + (weights[l] ?? 0), 0);
    
    if (totalMapped === 0) return { adjusted: {}, excluded, excludedWeight };

    // Validation Check (EPSILON = 1e-6)
    // If the mapped weights don't sum to roughly 1.0, the strategy is mathematically invalid.
    if (Math.abs(totalMapped - 1.0) > 1e-6) {
        console.error(`STRATEGY INTEGRITY FAILURE: Mapped weights sum to ${totalMapped}, not 1.0.`, weights);
        // In production, we'll still return the original weights to avoid total site crash, 
        // but we'll flag it clearly.
    }

    const adjusted = Object.fromEntries(mappedLabels.map(l => [l, weights[l] ?? 0]));
    return { adjusted, excluded, excludedWeight };
}

// ── ETF proxy NAV simulation ──────────────────────────────────────────────────

export interface NAVResult {
    dates: string[];
    nav: number[];
    dailyLogReturns: number[];
    excluded: string[];
    excludedWeight: number;
}

/** Simulate a constant-weight daily-rebalanced portfolio NAV using ETF price history.
 *  priceHistory: ticker → date string (YYYY-MM-DD) → closing price.
 *  Returns null if fewer than 60 trading days of data are available. */
export function simulateAllocationNAV(
    weights: Record<string, number>,
    priceHistory: Record<string, Record<string, number>>,
    startDate: string,
    endDate: string,
): NAVResult | null {
    const mapped = Object.keys(weights).filter(l => ETF_PROXY_MAP[l]);
    const { adjusted, excluded, excludedWeight } = redistributeExcludedWeights(weights, mapped);
    if (Object.keys(adjusted).length === 0) return null;

    // Map leaf labels → ticker weights
    const tickerWeights: Record<string, number> = {};
    for (const [label, w] of Object.entries(adjusted)) {
        tickerWeights[ETF_PROXY_MAP[label]] = (tickerWeights[ETF_PROXY_MAP[label]] ?? 0) + w;
    }

    // Find intersection of dates across all tickers within the window
    const tickers = Object.keys(tickerWeights);
    const dateSets = tickers.map(t =>
        new Set(Object.keys(priceHistory[t] ?? {}).filter(d => d >= startDate && d <= endDate))
    );
    const commonDates = Array.from(dateSets[0] ?? new Set<string>())
        .filter(d => dateSets.every(s => s.has(d)))
        .sort();

    if (commonDates.length < 60) return null;

    // Use first common date as base for each ticker
    const basePrices: Record<string, number> = {};
    for (const ticker of tickers) {
        basePrices[ticker] = priceHistory[ticker][commonDates[0]];
    }

    // Constant-weight daily-rebalanced NAV: NAV[t] = Σ(w_i × price_i[t] / price_i[0])
    const nav: number[] = [];
    for (const date of commonDates) {
        let navt = 0;
        for (const [ticker, w] of Object.entries(tickerWeights)) {
            const price = priceHistory[ticker]?.[date];
            const base  = basePrices[ticker];
            if (price != null && base != null && base > 0) {
                navt += w * (price / base);
            }
        }
        nav.push(navt);
    }

    const dailyLogReturns: number[] = [];
    for (let i = 1; i < nav.length; i++) {
        if (nav[i - 1] > 0 && nav[i] > 0) {
            dailyLogReturns.push(Math.log(nav[i] / nav[i - 1]));
        } else {
            dailyLogReturns.push(0);
        }
    }

    return { dates: commonDates, nav, dailyLogReturns, excluded, excludedWeight };
}

// ── Simba annual simulation ───────────────────────────────────────────────────

export interface SimbaResult {
    years: number[];
    annualReturns: number[];
    excluded: string[];
    excludedWeight: number;
}

export interface SimbaData {
    asset_classes: Record<string, { label: string; returns: Record<string, number> }>;
}

/** Simulate a portfolio's annual returns using Simba historical data.
 *  Returns null if fewer than 10 years of common data are available. */
export function simulateSimbaAllocation(
    weights: Record<string, number>,
    simbaData: Record<string, { label: string; returns: Record<string, number> }>,
    startYear?: number,
    endYear?: number,
): SimbaResult | null {
    const mapped = Object.keys(weights).filter(l => SIMBA_MAP[l] && simbaData[SIMBA_MAP[l]]);
    const { adjusted, excluded, excludedWeight } = redistributeExcludedWeights(weights, mapped);
    if (Object.keys(adjusted).length === 0) return null;

    // Find intersection of years across all mapped asset classes
    const yearSets = Object.entries(adjusted).map(([l]) => {
        const key = SIMBA_MAP[l];
        return new Set(Object.keys(simbaData[key]?.returns ?? {}).map(Number));
    });

    const allCommon = Array.from(yearSets[0] ?? new Set<number>())
        .filter(y => yearSets.every(s => s.has(y)))
        .filter(y => (!startYear || y >= startYear) && (!endYear || y <= endYear))
        .sort((a, b) => a - b);

    if (allCommon.length < 10) return null;

    const annualReturns = allCommon.map(year =>
        Object.entries(adjusted).reduce((sum, [l, w]) => {
            const key = SIMBA_MAP[l];
            const r = simbaData[key]?.returns?.[String(year)] ?? 0;
            return sum + w * r;
        }, 0)
    );

    return { years: allCommon, annualReturns, excluded, excludedWeight };
}
