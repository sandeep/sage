// src/lib/logic/portfolioEngine.ts
import db from '../db/client';
import { calculateSharpeRatio, calculateSortinoRatio, calculateCorrelation } from './alpha';
import { calculateM2, calculateAlpha, calculateCaptureRatios } from './performanceMetrics';
import { TODAY_ANCHOR, getTrailingYearStart } from './referenceDates';
import { getStrategicSettings } from '../db/settings';

// NEW EXPORTED FUNCTION: Explicit join logic to replace the VIEW
export function getHoldings() {
    return db.prepare(`
        SELECT
            h.*,
            a.nickname,
            a.provider,
            a.tax_character,
            a.account_type,
            r.asset_type,
            r.custom_er,
            r.weights
        FROM holdings_ledger h
        JOIN (
            SELECT account_id, MAX(snapshot_date) as max_date
            FROM holdings_ledger
            GROUP BY account_id
        ) latest ON h.account_id = latest.account_id AND h.snapshot_date = latest.max_date
        LEFT JOIN accounts a ON h.account_id = a.id
        LEFT JOIN asset_registry r ON h.ticker = r.ticker;
    `).all() as any[];
}

export function getPortfolioWeights(): Record<string, number> {
    const holdings = getHoldings();
    const totalValue = holdings.reduce((sum, h) => sum + (h.market_value || 0), 0);
    if (totalValue === 0) return {};
    
    const weights: Record<string, number> = {};
    for (const h of holdings) {
        const cat = h.category || 'Other';
        weights[cat] = (weights[cat] || 0) + (h.market_value || 0);
    }
    for (const cat in weights) {
        weights[cat] /= totalValue;
    }
    return weights;
}


export interface PortfolioPerformanceMetrics {
    return1y: number | null;
    annualizedVol: number | null;
    sharpe: number | null;
    sortino: number | null;
    beta: number | null;
    alpha: number | null;
    m2: number | null;
    upsideCapture: number | null;
    downsideCapture: number | null;
    correlationVTI: number | null;
    maxDrawdown: number | null;
    tradingDaysCounted: number;
    hasBenchmark: boolean;
    totalPortfolioValue: number;
}

interface HoldingRow { ticker: string; quantity: number; market_value: number | null; }

function buildTickerLogReturns(ticker: string, dates: string[]): Map<string, number> {
    const startDate = getTrailingYearStart();
    const priceRows = db.prepare(`
        SELECT date, close FROM price_history
        WHERE ticker = ? AND date >= ? AND date <= ?
        ORDER BY date ASC
    `).all(ticker, startDate, TODAY_ANCHOR) as { date: string; close: number }[];

    const priceByDate = new Map<string, number>();
    priceRows.forEach(r => priceByDate.set(r.date, r.close));

    let lastPrice: number | null = null;
    const filled = new Map<string, number>();
    for (const d of dates) {
        if (priceByDate.has(d)) lastPrice = priceByDate.get(d)!;
        if (lastPrice !== null) filled.set(d, lastPrice);
    }
    return filled;
}

export function calculatePortfolioPerformance(): PortfolioPerformanceMetrics {
    const TRADING_DAYS = 252;
    const startDate = getTrailingYearStart();
    
    // FETCH DYNAMIC SETTINGS
    const settings = getStrategicSettings();
    const annualRF = settings.risk_free_rate;
    const dailyRF = annualRF / TRADING_DAYS;

    const holdings = getHoldings();

    if (holdings.length === 0) {
        return { return1y: null, annualizedVol: null, sharpe: null, sortino: null,
                 beta: null, alpha: null, m2: null, upsideCapture: null, downsideCapture: null,
                 correlationVTI: null, maxDrawdown: null, tradingDaysCounted: 0,
                 hasBenchmark: false, totalPortfolioValue: 0 };
    }

    const allDates = (db.prepare(`
        SELECT DISTINCT date FROM price_history
        WHERE date >= ? AND date <= ?
        ORDER BY date ASC
    `).all(startDate, TODAY_ANCHOR) as { date: string }[]).map(r => r.date);

    if (allDates.length < 10) {
        return { return1y: null, annualizedVol: null, sharpe: null, sortino: null,
                 beta: null, alpha: null, m2: null, upsideCapture: null, downsideCapture: null,
                 correlationVTI: null, maxDrawdown: null, tradingDaysCounted: 0,
                 hasBenchmark: false, totalPortfolioValue: 0 };
    }

    const priceSeriesMap = new Map<string, Map<string, number>>();
    holdings.forEach(h => {
        priceSeriesMap.set(h.ticker, buildTickerLogReturns(h.ticker, allDates));
    });

    const dailyNAV: number[] = [];
    const currentTotalValue = holdings.reduce((sum, h) => {
        if (h.market_value) return sum + h.market_value;
        const priceMap = priceSeriesMap.get(h.ticker);
        const priceToday = priceMap?.get(allDates[allDates.length - 1]);
        if (priceToday && h.quantity) return sum + (h.quantity * priceToday);
        return sum;
    }, 0);

    for (const date of allDates) {
        let nav = 0;
        for (const h of holdings) {
            if (h.ticker === 'CASH' || h.ticker === 'TOTAL' || !h.quantity) {
                nav += (h.market_value || 0);
            } else {
                const priceMap = priceSeriesMap.get(h.ticker);
                const priceToday = priceMap?.get(allDates[allDates.length - 1]);
                const priceThen  = priceMap?.get(date);
                
                if (priceToday && priceThen) {
                    const currentVal = (h.market_value || (h.quantity * priceToday));
                    nav += currentVal * (priceThen / priceToday);
                } else {
                    nav += (h.market_value || 0);
                }
            }
        }
        dailyNAV.push(nav);
    }

    if (dailyNAV.length < 2) {
        return { return1y: null, annualizedVol: null, sharpe: null, sortino: null,
                 beta: null, alpha: null, m2: null, upsideCapture: null, downsideCapture: null,
                 correlationVTI: null, maxDrawdown: null, tradingDaysCounted: 0,
                 hasBenchmark: false, totalPortfolioValue: currentTotalValue };
    }

    const logReturns: number[] = [];
    for (let i = 1; i < dailyNAV.length; i++) {
        if (dailyNAV[i - 1] > 0 && dailyNAV[i] > 0) {
            logReturns.push(Math.log(dailyNAV[i] / dailyNAV[i - 1]));
        }
    }

    const return1y = (dailyNAV[dailyNAV.length - 1] / dailyNAV[0]) - 1;
    const n = logReturns.length;
    const mean = logReturns.reduce((a, b) => a + b, 0) / n;
    const variance = logReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / n;
    const annualizedVol = Math.sqrt(variance * TRADING_DAYS);

    let maxDrawdown: number | null = null;
    let peak = dailyNAV[0];
    let maxDD = 0;
    for (const nav of dailyNAV) {
        if (nav > peak) peak = nav;
        const dd = (nav - peak) / peak;
        if (dd < maxDD) maxDD = dd;
    }
    maxDrawdown = maxDD;

    const sharpeRaw = calculateSharpeRatio(logReturns, dailyRF);
    const sortinoRaw = calculateSortinoRatio(logReturns, dailyRF);
    const sharpe = sharpeRaw * Math.sqrt(TRADING_DAYS);
    const sortino = sortinoRaw * Math.sqrt(TRADING_DAYS);

    let beta: number | null = null;
    let alpha: number | null = null;
    let m2: number | null = null;
    let upsideCapture: number | null = null;
    let downsideCapture: number | null = null;
    let correlationVTI: number | null = null;
    let hasBenchmark = false;

    const vtiPricesRaw = db.prepare(`
        SELECT date, close FROM price_history
        WHERE ticker = 'VTI' AND date >= ? AND date <= ?
        ORDER BY date ASC
    `).all(startDate, TODAY_ANCHOR) as { date: string; close: number }[];

    if (vtiPricesRaw.length >= 10) {
        const vtiByDate = new Map<string, number>();
        vtiPricesRaw.forEach(r => vtiByDate.set(r.date, r.close));

        let lastVti: number | null = null;
        const vtiNAV: number[] = [];
        const alignedPortNAV: number[] = [];
        for (let di = 0; di < allDates.length; di++) {
            const d = allDates[di];
            if (vtiByDate.has(d)) lastVti = vtiByDate.get(d)!;
            if (lastVti === null) continue;
            vtiNAV.push(lastVti);
            alignedPortNAV.push(dailyNAV[di]);
        }

        const vtiLogReturns: number[] = [];
        const portLogReturnsAligned: number[] = [];
        for (let i = 1; i < vtiNAV.length; i++) {
            if (vtiNAV[i - 1] > 0 && vtiNAV[i] > 0 && alignedPortNAV[i - 1] > 0 && alignedPortNAV[i] > 0) {
                vtiLogReturns.push(Math.log(vtiNAV[i] / vtiNAV[i - 1]));
                portLogReturnsAligned.push(Math.log(alignedPortNAV[i] / alignedPortNAV[i - 1]));
            }
        }

        const len = Math.min(portLogReturnsAligned.length, vtiLogReturns.length);
        if (len >= 10) {
            const portSlice = portLogReturnsAligned.slice(0, len);
            const vtiSlice = vtiLogReturns.slice(0, len);
            const pMean = portSlice.reduce((a, b) => a + b, 0) / len;
            const vtiMean = vtiSlice.reduce((a, b) => a + b, 0) / len;
            const cov = portSlice.reduce((acc, r, i) => acc + (r - pMean) * (vtiSlice[i] - vtiMean), 0) / len;
            const vtiVar = vtiSlice.reduce((acc, r) => acc + (r - vtiMean) ** 2, 0) / len;

            beta = vtiVar > 0 ? cov / vtiVar : null;
            correlationVTI = calculateCorrelation(portSlice, vtiSlice);

            const vtiReturn = (vtiNAV[vtiNAV.length - 1] / vtiNAV[0]) - 1;
            const portReturnAligned = (alignedPortNAV[alignedPortNAV.length - 1] / alignedPortNAV[0]) - 1;
            const vtiVariance = vtiSlice.reduce((acc, r) => acc + (r - vtiMean) ** 2, 0) / len;
            const vtiVol = Math.sqrt(vtiVariance * TRADING_DAYS);

            const alignedSharpeRaw = calculateSharpeRatio(portSlice, dailyRF);
            const alignedSharpe = alignedSharpeRaw * Math.sqrt(TRADING_DAYS);

            if (beta !== null) alpha = calculateAlpha(portReturnAligned, vtiReturn, beta, annualRF);
            if (Number.isFinite(alignedSharpe)) m2 = calculateM2(alignedSharpe, vtiVol, annualRF);

            const captures = calculateCaptureRatios(portSlice, vtiSlice);
            upsideCapture = captures.upside;
            downsideCapture = captures.downside;
            hasBenchmark = true;
        }
    }

    return {
        return1y, annualizedVol, sharpe: Number.isFinite(sharpe) ? sharpe : null,
        sortino: Number.isFinite(sortino) ? sortino : null,
        beta, alpha, m2, upsideCapture, downsideCapture, correlationVTI,
        maxDrawdown, tradingDaysCounted: n, hasBenchmark, totalPortfolioValue: currentTotalValue
    };
}
