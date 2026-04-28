import simbaData from '../data/simba_returns.json';
import { getStrategicSettings } from '../db/settings';

export interface SimbaSeries {
    date: string;
    value: number;
    drawdown: number;
}

export interface SimbaResult {
    annualizedReturn: number;
    volatility: number;
    sharpe: number;
    m2: number;
    maxDrawdown: number;
    coveragePct: number;
    annualReturns: number[];
    marketReturn: number;
    marketVol: number;
    years: number[];
    series: SimbaSeries[];
}

export const TICKER_TO_SIMBA: Record<string, string> = {
    "VTI": "VTI", "VTSAX": "TSM", "ITOT": "TSM",
    "VOO": "LCB", "SPY": "LCB", "IVV": "LCB", "VFIAX": "LCB", "FXAIX": "LCB", "VIIIX": "LCB",
    "VBR": "SCV", "VIOV": "SCV", "VSIAX": "SCV", "VB": "SCV", "VIOO": "SCV",
    "VNQ": "REIT", "VGSLX": "REIT", "FSRNX": "REIT",
    "VXUS": "INTL", "VEA": "INTL", "VTMGX": "INTL", "FSPSX": "INTL", "IEFA": "INTL", "SCHF": "INTL",
    "VWO": "EM", "VEMAX": "EM", "FPADX": "EM", "SCHE": "EM", "IEMG": "EM",
    "BND": "ITT", "AGG": "ITT", "VBTLX": "ITT", "FSKAX": "TSM", "FZROX": "TSM", "BNDX": "ITT",
    "CASH": "Cash", "BIL": "Cash", "SHV": "Cash", "VMFXX": "Cash"
};

export const LABEL_TO_SIMBA: Record<string, string> = {
    "Total Stock Market": "TSM", "TSM": "TSM", "Stock": "TSM", "US Stock": "TSM", "US Total Stock Market": "TSM", "US_TOTAL_STOCK": "VTI",
    "US Large Cap/SP500/DJIX": "LCB", "LCB": "LCB", "US Large Cap": "LCB", "S&P 500": "LCB",
    "Small Cap Value": "SCV", "SCV": "SCV", "Small-Cap": "SCV", "Small Cap": "SCV", "US Small Cap": "SCV",
    "REIT": "REIT", "Real Estate": "REIT",
    "Developed Market": "INTL", "INTL": "INTL", "Intl'l Stock": "INTL", "Total Int'l Stock Market": "INTL", "Int'l Small Cap": "INTL", "Int'l Value": "INTL", "International Stock": "INTL",
    "Emerging Market": "EM", "EM": "EM", "Emerging Markets": "EM",
    "US Aggregate Bond": "ITT", "ITT": "ITT", "Bond": "ITT", "US Bond": "ITT", "Total Bond Market": "ITT",
    "Cash": "Cash", "CASH": "Cash", "Money Market": "Cash",
    "Healthcare": "TSM",
    "Energy": "TSM",
    "Mid-Cap": "LCB",
    "Non Big (Ext Market/Small Blend)": "SCV"
};

/**
 * Calculates historical proxy returns using Simba annual data.
 * @param weights Record of ticker OR label to weight (e.g. { "VTI": 0.6 } or { "REIT": 0.1 })
 * @param horizonYears Number of years to backtest (trailing from latest available year)
 * @param specificYears Optional array of years to use instead of trailing window
 */
export function calculateHistoricalProxyReturns(
    weights: Record<string, number>,
    horizonYears: number,
    specificYears?: number[]
): SimbaResult {
    // 1. Redistribution
    const mappedWeights: Record<string, number> = {};
    let totalMappedWeight = 0;
    let originalTotalWeight = 0;

    for (const [key, weight] of Object.entries(weights)) {
        originalTotalWeight += weight;
        // Try Ticker mapping first, then Label mapping
        const simbaClass = TICKER_TO_SIMBA[key.toUpperCase()] || LABEL_TO_SIMBA[key];
        
        if (simbaClass) {
            mappedWeights[simbaClass] = (mappedWeights[simbaClass] || 0) + weight;
            totalMappedWeight += weight;
        }
    }

    if (totalMappedWeight === 0 || originalTotalWeight === 0) {
        return {
            annualizedReturn: 0, volatility: 0, sharpe: 0, m2: 0, maxDrawdown: 0, coveragePct: 0,
            annualReturns: [], marketReturn: 0, marketVol: 0, years: [], series: []
        };
    }

    // Redistribute mapped weights to sum to 100% of the mapped portion
    for (const simbaClass in mappedWeights) {
        mappedWeights[simbaClass] /= totalMappedWeight;
    }

    const coveragePct = totalMappedWeight / originalTotalWeight;

    // 2. Identify years
    const assetClasses = (simbaData as any).asset_classes;
    const availableYears = Object.keys(assetClasses.TSM.returns).sort((a, b) => parseInt(a) - parseInt(b));
    
    let targetYears: string[];
    if (specificYears && specificYears.length > 0) {
        targetYears = specificYears.map(y => String(y)).filter(y => availableYears.includes(y));
    } else {
        targetYears = availableYears.slice(-Math.min(horizonYears, availableYears.length));
    }
    
    if (targetYears.length === 0) {
        return {
            annualizedReturn: 0, volatility: 0, sharpe: 0, m2: 0, maxDrawdown: 0, coveragePct,
            annualReturns: [], marketReturn: 0, marketVol: 0, years: [], series: []
        };
    }

    // 3. Calculation with Intelligent Fallbacks
    const getHistoricalReturn = (simbaClass: string, year: string): number => {
        const cls = assetClasses[simbaClass];
        if (cls && cls.returns && cls.returns[year] !== undefined) {
            return cls.returns[year];
        }
        // Fallback hierarchy: TSM for equities, ITT for bonds, Cash for cash
        if (['INTL', 'EM', 'SCV', 'REIT', 'LCB'].includes(simbaClass)) return assetClasses['TSM']?.returns[year] ?? 0;
        if (['ITT'].includes(simbaClass)) return assetClasses['ITT']?.returns[year] ?? 0;
        return 0;
    };

    const annualReturns: number[] = [];
    const benchmarkReturns: number[] = [];
    const series: SimbaSeries[] = [];
    let cumulativePortfolioValue = 1.0;
    let cumulativeBenchmarkValue = 1.0;
    let peak = 1.0;
    let maxDrawdown = 0;

    for (const year of targetYears) {
        let portfolioYearReturn = 0;
        for (const [simbaClass, weight] of Object.entries(mappedWeights)) {
            if (simbaClass === 'Cash') {
                portfolioYearReturn += weight * 0.00; 
            } else {
                portfolioYearReturn += weight * getHistoricalReturn(simbaClass, year);
            }
        }
        annualReturns.push(portfolioYearReturn);
        cumulativePortfolioValue *= (1 + portfolioYearReturn);
        
        if (cumulativePortfolioValue > peak) peak = cumulativePortfolioValue;
        const currentDrawdown = (cumulativePortfolioValue / peak) - 1;
        if (currentDrawdown < maxDrawdown) maxDrawdown = currentDrawdown;

        series.push({ date: year, value: cumulativePortfolioValue, drawdown: currentDrawdown });
        
        const vtiRetVal = assetClasses.VTI.returns[year] ?? 0;
        benchmarkReturns.push(vtiRetVal);
        cumulativeBenchmarkValue *= (1 + vtiRetVal);
    }

    // 4. Metrics
    // CAGR (Geometric Mean of compounded rebalanced returns for the WINDOW)
    const annualizedReturn = annualReturns.length > 0 
        ? Math.pow(cumulativePortfolioValue, 1 / annualReturns.length) - 1
        : 0;

    const marketReturn = benchmarkReturns.length > 0
        ? Math.pow(cumulativeBenchmarkValue, 1 / benchmarkReturns.length) - 1
        : 0;
    
    // STEADY-STATE VOLATILITY (The Red Team Fix)
    // To prevent Sharpe explosions from small sample sizes (3Y/5Y),
    // we calculate volatility over the ENTIRE available history for this mix.
    const fullHistoryPortfolioReturns: number[] = [];
    const fullHistoryBenchmarkReturns: number[] = [];
    const allYears = Object.keys(assetClasses.TSM.returns).sort();

    for (const year of allYears) {
        let yearReturn = 0;
        for (const [simbaClass, weight] of Object.entries(mappedWeights)) {
            if (simbaClass === 'Cash') {
                yearReturn += weight * 0.00;
            } else {
                const classReturn = assetClasses[simbaClass]?.returns[year];
                yearReturn += weight * (classReturn !== undefined ? classReturn : 0);
            }
        }
        fullHistoryPortfolioReturns.push(yearReturn);
        const vtiRet = assetClasses.VTI.returns[year];
        fullHistoryBenchmarkReturns.push(vtiRet !== undefined ? vtiRet : 0);
    }

    const meanFull = fullHistoryPortfolioReturns.reduce((a, b) => a + b, 0) / fullHistoryPortfolioReturns.length;
    const volatility = Math.sqrt(fullHistoryPortfolioReturns.reduce((a, r) => a + Math.pow(r - meanFull, 2), 0) / fullHistoryPortfolioReturns.length);

    const meanBenchFull = fullHistoryBenchmarkReturns.reduce((a, b) => a + b, 0) / fullHistoryBenchmarkReturns.length;
    const marketVol = Math.sqrt(fullHistoryBenchmarkReturns.reduce((a, r) => a + Math.pow(r - meanBenchFull, 2), 0) / fullHistoryBenchmarkReturns.length);

    // Sharpe (using provided Rf and Steady-State Vol)
    const settings = getStrategicSettings();
    const rf = settings.risk_free_rate; 
    const sharpe = volatility === 0 ? 0 : (annualizedReturn - rf) / volatility;

    // M2 = (Sharpe_p * Vol_b) + Rf
    const m2 = (sharpe * marketVol) + rf;

    return {
        annualizedReturn,
        volatility,
        sharpe,
        m2,
        maxDrawdown,
        coveragePct,
        annualReturns,
        marketReturn,
        marketVol,
        years: targetYears.map(y => parseInt(y)),
        series
    };
}
