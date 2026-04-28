
import db from '../db/client';
import { getLatestPrice, getTickerMap } from '../db/prices';
import { getAllocationTree } from '../db/allocation';

export interface AccountHoldingDetail {
    accountId: string;
    accountName: string;
    provider: string;
    quantity: number;
    value: number | null;
}

export interface MetricContributor {
    ticker: string;
    value: number;
    pct: number;
    accounts?: AccountHoldingDetail[];
    yield?: number;
    er?: number;
    close?: number;
    fiftyTwoWeekLow?: number;
    fiftyTwoWeekHigh?: number;
    name?: string;
    return1y?: number;
    indexTracked?: string;
    offHighDelta?: number; // (Current / 52W High) - 1
}

export interface MetricRow {
    label: string;
    level: -1 | 0 | 1 | 2;
    expectedPortfolio: number;
    expectedInParent: number;
    actualPortfolio: number;
    actualInParent: number;
    actualValue: number;
    expectedReturn?: number;
    contributors?: MetricContributor[];
}

export function resolveValue(ticker: string, quantity: number | null | undefined, marketValue: number | null): number | null {
    if (marketValue !== null && marketValue > 0) return marketValue;
    try {
        const price = db.prepare("SELECT close FROM price_history WHERE ticker = ? ORDER BY date DESC LIMIT 1").get(ticker) as any;
        if (price?.close != null) {
            if (quantity === null || quantity === undefined) return null;
            return quantity * price.close;
        }
    } catch (e) {
        return null;
    }
    return null;
}

export function calculateHierarchicalMetrics(): MetricRow[] {
    try {
        const targetAllocation = getAllocationTree() || {};
        const holdings = db.prepare("SELECT * FROM enriched_holdings").all() as any[];
        const totalPortfolioValue = holdings.reduce((acc, h) => acc + (h.market_value || 0), 0);
        if (totalPortfolioValue === 0) return [];

        const tickerMap = getTickerMap();
        const tickerValues: Record<string, number> = {};
        holdings.forEach(h => { tickerValues[h.ticker] = h.market_value || 0; });

        const rows: MetricRow[] = [];

        const getActualValue = (categoryLabel: string): number => {
            let sum = 0;
            Object.entries(tickerMap).forEach(([ticker, config]) => {
                const weight = (config.weights as any)[categoryLabel] || 0;
                if (weight > 0) sum += (tickerValues[ticker] || 0) * weight;
            });
            return sum;
        };

        const getLeafLabels = (node: any, label: string): string[] => {
            const leaves: string[] = [];
            function walkLeaves(n: any, l: string) {
                if (n.subcategories) Object.keys(n.subcategories).forEach(s => walkLeaves(n.subcategories[s], s));
                else if (n.categories) Object.keys(n.categories).forEach(c => walkLeaves(n.categories[c], c));
                else leaves.push(l);
            }
            walkLeaves(node, label);
            return leaves;
        };

        const getContributors = (leafLabels: string[]): MetricContributor[] => {
            const totals: Record<string, number> = {};
            leafLabels.forEach(label => {
                Object.entries(tickerMap).forEach(([ticker, config]) => {
                    const weight = (config.weights as any)[label] || 0;
                    const val = (tickerValues[ticker] || 0) * weight;
                    if (val > 0) totals[ticker] = (totals[ticker] || 0) + val;
                });
            });
            const grand = Object.values(totals).reduce((s, v) => s + v, 0) || 1;
            return Object.entries(totals)
                .filter(([, v]) => v > 0)
                .map(([ticker, value]) => {
                    const h = holdings.find(x => x.ticker === ticker);
                    const accounts = h?.account_list?.split(',').map((name: string) => ({
                        accountName: name,
                        provider: 'Fidelity',
                        value: value
                    })) || [];

                    const cur = h?.close;
                    const high = h?.fiftyTwoWeekHigh;
                    const offHigh = (cur && high && high > 0) ? (cur / high) - 1 : undefined;

                    return {
                        ticker, value, pct: value / grand,
                        accounts,
                        yield: h?.yield, 
                        er: h?.expense_ratio, 
                        close: h?.close,
                        fiftyTwoWeekLow: h?.fiftyTwoWeekLow, 
                        fiftyTwoWeekHigh: h?.fiftyTwoWeekHigh,
                        name: h?.instrument_name,
                        return1y: h?.return1y,
                        indexTracked: h?.index_tracked,
                        offHighDelta: offHigh
                    };
                })
                .sort((a, b) => b.value - a.value);
        };

        const processNode = (label: string, data: any, level: 0 | 1 | 2, parentActual: number, parentExpected: number) => {
            const leaves = getLeafLabels(data, label);
            const nodeActual = leaves.reduce((acc, l) => acc + getActualValue(l), 0);
            
            rows.push({
                label, level,
                expectedPortfolio: data.weight || 0,
                expectedInParent: parentExpected > 0 ? (data.weight || 0) / parentExpected : 0,
                actualPortfolio: nodeActual / totalPortfolioValue,
                actualInParent: parentActual > 0 ? nodeActual / parentActual : 0,
                actualValue: nodeActual,
                expectedReturn: data.expected_return,
                contributors: getContributors(leaves),
            });

            if (data.categories) Object.entries(data.categories).forEach(([l, d]) => processNode(l, d as any, 1, nodeActual, data.weight || 0));
            if (data.subcategories) Object.entries(data.subcategories).forEach(([l, d]) => processNode(l, d as any, 2, nodeActual, data.weight || 0));
        };

        rows.push({
            label: 'Total Portfolio', level: -1,
            expectedPortfolio: 1.0, expectedInParent: 1.0,
            actualPortfolio: 1.0, actualInParent: 1.0,
            actualValue: totalPortfolioValue
        });

        const CATEGORY_ORDER = ['Stock', 'Bond', 'Cash'];
        CATEGORY_ORDER.forEach(root => {
            if (targetAllocation[root]) processNode(root, targetAllocation[root], 0, totalPortfolioValue, 1.0);
        });

        return rows;
    } catch (e: any) {
        console.error("X-Ray Failed:", e.message);
        return [];
    }
}
