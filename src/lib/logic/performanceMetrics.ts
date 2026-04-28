// src/lib/logic/performanceMetrics.ts
//
// Pure statistical functions for portfolio performance analysis.
// All functions are stateless and operate on arrays of returns or NAV values.
// annualizationFactor: 252 for daily data, 1 for annual data.

/** Reconstruct a cumulative NAV array from a series of annual (or periodic) returns.
 *  NAV starts at 1.0. Used to convert Simba annual return series into a peak-to-trough
 *  drawable series before calling computeMaxDrawdown. */
export function navFromAnnualReturns(annualReturns: number[]): number[] {
    const nav = [1.0];
    for (const r of annualReturns) {
        nav.push(nav[nav.length - 1] * (1 + r));
    }
    return nav;
}

/** Peak-to-trough maximum drawdown on a NAV array.
 *  Returns a negative decimal (e.g. −0.38 for a 38% drawdown), or 0 if NAV never falls. */
export function computeMaxDrawdown(nav: number[]): number {
    if (nav.length < 2) return 0;
    let peak = nav[0];
    let maxDD = 0;
    for (const v of nav) {
        if (v > peak) peak = v;
        if (peak > 0) {
            const dd = (v - peak) / peak;
            if (dd < maxDD) maxDD = dd;
        }
    }
    return maxDD;
}

/** Annualized tracking error: std dev of (portfolio − benchmark) excess returns,
 *  scaled by sqrt(annualizationFactor). */
export function computeTrackingError(
    portfolioReturns: number[],
    benchmarkReturns: number[],
    annualizationFactor: number,
): number {
    const len = Math.min(portfolioReturns.length, benchmarkReturns.length);
    if (len < 2) return 0;
    const excess = Array.from({ length: len }, (_, i) => portfolioReturns[i] - benchmarkReturns[i]);
    const mean = excess.reduce((a, b) => a + b, 0) / len;
    const variance = excess.reduce((a, e) => a + (e - mean) ** 2, 0) / len;
    if (variance < Number.EPSILON) return 0;
    return Math.sqrt(variance * annualizationFactor);
}

/** Annualized information ratio: annualized mean excess return divided by tracking error. */
export function computeInformationRatio(
    portfolioReturns: number[],
    benchmarkReturns: number[],
    annualizationFactor: number,
): number {
    const len = Math.min(portfolioReturns.length, benchmarkReturns.length);
    if (len < 2) return 0;
    const excess = Array.from({ length: len }, (_, i) => portfolioReturns[i] - benchmarkReturns[i]);
    const meanExcess = excess.reduce((a, b) => a + b, 0) / len;
    const te = computeTrackingError(portfolioReturns, benchmarkReturns, annualizationFactor);
    if (te === 0) return 0;
    return (meanExcess * annualizationFactor) / te;
}

/** Upside capture ratio: geometric mean of portfolio returns / geometric mean of benchmark
 *  returns, restricted to periods where benchmark > 0.
 *  > 1.0 means portfolio captures more upside than benchmark. */
export function computeUpsideCapture(
    portfolioReturns: number[],
    benchmarkReturns: number[],
): number {
    const len = Math.min(portfolioReturns.length, benchmarkReturns.length);
    const up: Array<{ port: number; bench: number }> = [];
    for (let i = 0; i < len; i++) {
        if (benchmarkReturns[i] > 0) up.push({ port: portfolioReturns[i], bench: benchmarkReturns[i] });
    }
    if (up.length === 0) return 0;
    const portGeo  = up.reduce((p, r) => p * (1 + r.port),  1) ** (1 / up.length) - 1;
    const benchGeo = up.reduce((p, r) => p * (1 + r.bench), 1) ** (1 / up.length) - 1;
    return benchGeo === 0 ? 0 : portGeo / benchGeo;
}

/** Downside capture ratio: geometric mean of portfolio returns / geometric mean of benchmark
 *  returns, restricted to periods where benchmark < 0.
 *  < 1.0 means portfolio loses less than benchmark in down periods (good). */
export function computeDownsideCapture(
    portfolioReturns: number[],
    benchmarkReturns: number[],
): number {
    const len = Math.min(portfolioReturns.length, benchmarkReturns.length);
    const down: Array<{ port: number; bench: number }> = [];
    for (let i = 0; i < len; i++) {
        if (benchmarkReturns[i] < 0) down.push({ port: portfolioReturns[i], bench: benchmarkReturns[i] });
    }
    if (down.length === 0) return 0;
    const portGeo  = down.reduce((p, r) => p * (1 + r.port),  1) ** (1 / down.length) - 1;
    const benchGeo = down.reduce((p, r) => p * (1 + r.bench), 1) ** (1 / down.length) - 1;
    return benchGeo === 0 ? 0 : portGeo / benchGeo;
}

/** Modigliani-Modigliani (M2) measure: Risk-adjusted return relative to benchmark.
 *  Formula: (portfolioSharpe * benchmarkVol) + riskFreeRate */
export function calculateM2(portfolioSharpe: number, benchmarkVol: number, rf: number): number {
    return (portfolioSharpe * benchmarkVol) + rf;
}

/** Jensen's Alpha: Excess return of portfolio over its CAPM expected return.
 *  Formula: portReturn - (riskFreeRate + beta * (benchReturn - riskFreeRate)) */
export function calculateAlpha(portReturn: number, benchReturn: number, beta: number, rf: number): number {
    return portReturn - (rf + beta * (benchReturn - rf));
}

/** Calculate upside and downside capture ratios. */
export function calculateCaptureRatios(
    portReturns: number[],
    benchReturns: number[]
): { upside: number; downside: number } {
    return {
        upside: computeUpsideCapture(portReturns, benchReturns),
        downside: computeDownsideCapture(portReturns, benchReturns)
    };
}
