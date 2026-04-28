/**
 * Pure mathematical functions for portfolio metrics.
 * Extracted from comparisonEngine to improve maintainability.
 */

/**
 * Annualized return (Compound Annual Growth Rate).
 * @param nav - Daily or annual NAV series
 * @param nYears - Number of years the series covers
 */
export function calculateCAGR(nav: number[], nYears: number): number | null {
    if (nav.length < 2 || nYears <= 0) return null;
    const totalReturn = nav[nav.length - 1] / nav[0];
    return Math.pow(totalReturn, 1 / nYears) - 1;
}

/**
 * Standard deviation of returns annualized by the provided factor.
 * @param returns - Series of periodic returns (daily, monthly, etc.)
 * @param factor - Annualization factor (e.g. 252 for daily, 12 for monthly, 1 for annual)
 */
export function calculateVolatility(returns: number[], factor: number = 252): number {
    const n = returns.length;
    if (n < 2) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / n;
    const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / n;
    return Math.sqrt(variance * factor);
}

/**
 * Sharpe Ratio (period-based, needs to be annualized externally if needed).
 * @param returns - Series of periodic returns
 * @param riskFreeRate - Risk-free rate for the same period (e.g. daily RF for daily returns)
 */
export function computeSharpe(returns: number[], riskFreeRate: number): number | null {
    const n = returns.length;
    if (n < 2) return null;
    const mean = returns.reduce((a, b) => a + b, 0) / n;
    const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return null;
    return (mean - riskFreeRate) / stdDev;
}

/**
 * Sortino Ratio (period-based, needs to be annualized externally if needed).
 * @param returns - Series of periodic returns
 * @param riskFreeRate - Risk-free rate for the same period
 */
export function computeSortino(returns: number[], riskFreeRate: number): number | null {
    const n = returns.length;
    if (n < 2) return null;
    const mean = returns.reduce((a, b) => a + b, 0) / n;
    const downsideVariance = returns.reduce((a, r) => {
        const excess = r - riskFreeRate;
        return a + (excess < 0 ? excess ** 2 : 0);
    }, 0) / n;
    const downsideStdDev = Math.sqrt(downsideVariance);
    if (downsideStdDev === 0) return null;
    return (mean - riskFreeRate) / downsideStdDev;
}

/**
 * Time-Weighted Return (Cumulative period return).
 * This represents the growth of 1 unit of capital over the whole period.
 */
export function calculateTWR(nav: number[]): number | null {
    if (nav.length < 2) return null;
    return (nav[nav.length - 1] / nav[0]) - 1;
}
