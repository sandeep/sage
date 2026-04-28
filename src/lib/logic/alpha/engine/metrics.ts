import db from '@/lib/db/client';
import { getStrategicSettings } from '@/lib/db/settings';

export interface AlphaMetrics {
    totalPnl: number;
    totalDeposited: number;
    netReturnPct: number;
    twr: number;
    annualizedReturn: number;
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    informationRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    cvar95: number;
    dollarAlpha: number;
    shadowNav: number;
    mwr: number;
}

export interface BookTradeStats {
    book: string;
    totalTrades: number;
    distinctTickerCount: number;
    winRate: number;
    profitFactor: number;
    expectedValue: number;
    avgWin: number;
    avgLoss: number;
    maxWin: number;
    maxLoss: number;
    totalNetPnl: number;
    benchmarkAlpha: number;
    mwr: number;
    sharpeRatio: number;
    calmarRatio: number;
}

function calculateMWR(cashflows: { date: string, amount: number }[], terminalValue: number, terminalDate: string): number {
    if (cashflows.length === 0) return 0;
    
    const sorted = [...cashflows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const startDate = new Date(sorted[0].date).getTime();
    
    interface CF { t: number, amount: number }
    const cfs: CF[] = sorted.map(cf => ({
        t: (new Date(cf.date).getTime() - startDate) / (1000 * 60 * 60 * 24 * 365),
        amount: -cf.amount
    }));
    
    if (terminalValue !== 0) {
        const termT = (new Date(terminalDate).getTime() - startDate) / (1000 * 60 * 60 * 24 * 365);
        cfs.push({ t: termT, amount: terminalValue });
    }
    
    // If all cashflows sum to 0 or we have no positive/negative mix, IRR might be undefined or 0
    const totalOut = cfs.filter(c => c.amount < 0).reduce((a, b) => a + b.amount, 0);
    const totalIn = cfs.filter(c => c.amount > 0).reduce((a, b) => a + b.amount, 0);
    if (totalOut === 0 || totalIn === 0) return 0;

    let low = -0.9999;
    let high = 100;
    let r = 0;
    
    for (let i = 0; i < 100; i++) {
        r = (low + high) / 2;
        let npv = 0;
        for (const cf of cfs) {
            npv += cf.amount / Math.pow(1 + r, cf.t);
        }
        
        if (npv > 0) low = r;
        else high = r;
    }
    
    return r;
}

function calculateMaxDrawdownFromPnl(pnlSeries: number[]): number {
    if (pnlSeries.length === 0) return 0;
    let cumulative = 0;
    let peak = 0;
    let maxDD = 0;
    for (const pnl of pnlSeries) {
        cumulative += pnl;
        if (cumulative > peak) peak = cumulative;
        const dd = peak - cumulative;
        if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
}

function calculateSeriesVolatility(pnlSeries: number[]): number {
    if (pnlSeries.length === 0) return 0;
    const mean = pnlSeries.reduce((a, b) => a + b, 0) / pnlSeries.length;
    const variance = pnlSeries.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pnlSeries.length;
    return Math.sqrt(variance * 252);
}

export async function calculateAlphaMetrics(): Promise<AlphaMetrics> {
    const settings = getStrategicSettings();
    const rf = settings.risk_free_rate;

    const rows = db.prepare(`
        SELECT 
            date,
            daily_total as pnl,
            deposits,
            cumulative_pnl
        FROM alpha_daily_pnl
        ORDER BY date
    `).all() as { date: string, pnl: number, deposits: number, cumulative_pnl: number }[];

    if (rows.length === 0) {
        return {
            totalPnl: 0, totalDeposited: 0, netReturnPct: 0, twr: 0, annualizedReturn: 0,
            volatility: 0, sharpeRatio: 0, sortinoRatio: 0, informationRatio: 0,
            calmarRatio: 0, maxDrawdown: 0, cvar95: 0, dollarAlpha: 0, shadowNav: 0, mwr: 0
        };
    }

    let totalPnl = 0;
    let totalDeposited = 0;
    const dailyReturns: number[] = [];
    const alphaReturns: number[] = [];

    const { getVtiBenchmarkData } = await import('./benchmark');
    const benchmarkData = await getVtiBenchmarkData();
    const benchmarkMap = new Map(benchmarkData.map(b => [b.date, b.dailyReturn]));

    let currentNav = 0;
    let peakNav = 0;
    let maxDrawdown = 0;

    for (const row of rows) {
        const prevNav = currentNav;
        totalDeposited += row.deposits;
        
        let r = 0;
        if (prevNav > 0) r = row.pnl / prevNav;
        else if (row.deposits > 0) r = 0;

        dailyReturns.push(r);
        
        const benchReturn = benchmarkMap.get(row.date) || 0;
        alphaReturns.push(r - benchReturn);

        currentNav = currentNav + row.pnl + row.deposits;
        totalPnl += row.pnl;

        if (currentNav > peakNav) peakNav = currentNav;
        const dd = peakNav > 0 ? (peakNav - currentNav) / peakNav : 0;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const twr = dailyReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;
    const numDays = rows.length;
    const years = numDays / 252;
    const annualizedReturn = years > 0 ? Math.pow(1 + twr, 1 / years) - 1 : 0;

    const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance * 252);
    const sharpeRatio = volatility > 0 ? (annualizedReturn - rf) / volatility : 0;

    const negativeReturns = dailyReturns.filter(r => r < 0);
    const downsideVariance = negativeReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / dailyReturns.length;
    const downsideVol = Math.sqrt(downsideVariance * 252);
    const sortinoRatio = downsideVol > 0 ? (annualizedReturn - rf) / downsideVol : 0;

    const meanAlpha = alphaReturns.reduce((a, b) => a + b, 0) / alphaReturns.length;
    const varianceAlpha = alphaReturns.reduce((a, b) => a + Math.pow(b - meanAlpha, 2), 0) / alphaReturns.length;
    const alphaStdDev = Math.sqrt(varianceAlpha * 252);
    const informationRatio = alphaStdDev > 0 ? (meanAlpha * 252) / alphaStdDev : 0;

    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

    const sortedReturns = [...dailyReturns].sort((a, b) => a - b);
    const count5Pct = Math.max(1, Math.floor(sortedReturns.length * 0.05));
    const worst5Pct = sortedReturns.slice(0, count5Pct);
    const cvar95 = worst5Pct.reduce((a, b) => a + b, 0) / worst5Pct.length;

    // Fetch latest shadow VTI
    const latestShadow = db.prepare(`SELECT value, date FROM alpha_shadow_vti ORDER BY date DESC LIMIT 1`).get() as { value: number, date: string } | undefined;
    const shadowNav = latestShadow ? latestShadow.value : 0;
    const dollarAlpha = currentNav - shadowNav;

    // Calculate MWR
    const cashflows = rows.filter(r => r.deposits !== 0).map(r => ({ date: r.date, amount: r.deposits }));
    const terminalDate = rows.length > 0 ? rows[rows.length - 1].date : new Date().toISOString().split('T')[0];
    const mwr = calculateMWR(cashflows, currentNav, terminalDate);

    return {
        totalPnl, totalDeposited, netReturnPct: totalDeposited > 0 ? totalPnl / totalDeposited : 0,
        twr, annualizedReturn, volatility, sharpeRatio, sortinoRatio, informationRatio,
        calmarRatio, maxDrawdown, cvar95, dollarAlpha, shadowNav, mwr
    };
}

function getVtiPriceMap(): Map<string, number> {
    const prices = db.prepare(`SELECT date, close FROM price_history WHERE ticker = 'VTI' ORDER BY date`).all() as { date: string, close: number }[];
    const map = new Map<string, number>();
    for (const p of prices) map.set(p.date, p.close);
    return map;
}

function getClosestVtiPrice(date: string, map: Map<string, number>, sortedDates: string[]): number {
    if (map.has(date)) return map.get(date)!;
    let closest = sortedDates[0];
    for (const d of sortedDates) {
        if (d > date) break;
        closest = d;
    }
    return map.get(closest) || 0;
}

export async function getBookTradeStats(): Promise<BookTradeStats[]> {
    const stats: BookTradeStats[] = [];
    const vtiMap = getVtiPriceMap();
    const sortedVtiDates = Array.from(vtiMap.keys()).sort();
    const settings = getStrategicSettings();
    const rf = settings.risk_free_rate;

    // Fetch daily book PnLs for drawdown calculation
    const dailyBookPnls = db.prepare(`SELECT date, options_pnl, equity_pnl, futures_pnl FROM alpha_daily_pnl ORDER BY date`).all() as any[];
    const optDailyPnls = dailyBookPnls.map(r => r.options_pnl || 0);
    const eqDailyPnls = dailyBookPnls.map(r => r.equity_pnl || 0);

    const optMaxDD = calculateMaxDrawdownFromPnl(optDailyPnls);
    const eqMaxDD = calculateMaxDrawdownFromPnl(eqDailyPnls);

    // 1. Options Stats
    const options = db.prepare(`SELECT open_date, close_date, net_pnl, strike, open_qty, open_premium, hold_days FROM alpha_option_trades WHERE close_date IS NOT NULL`).all() as any[];
    const optionTickerCount = db.prepare(`SELECT COUNT(DISTINCT instrument) as n FROM alpha_option_trades WHERE close_date IS NOT NULL`).get() as { n: number };
    
    let optionsAlpha = 0;
    const optionCashflows: { date: string, amount: number }[] = [];
    const optionReturns: number[] = [];
    let optionTerminalDate = options.length > 0 ? options[0].close_date : '';

    for (const opt of options) {
        const notional = (opt.strike || 0) * 100 * Math.abs(opt.open_qty || 1);
        const holdDays = opt.hold_days || 0;
        const cashReturn = notional * (rf / 365) * holdDays;
        optionsAlpha += (opt.net_pnl - cashReturn);

        if (notional > 0) {
            optionReturns.push(opt.net_pnl / notional);
        }

        // MWR: Treating open premium as cash flow
        const premium = Math.abs(opt.open_premium);
        if (premium > 0) {
            optionCashflows.push({ date: opt.open_date, amount: premium });
            // Close is like a negative deposit of the final value
            optionCashflows.push({ date: opt.close_date, amount: -(premium + opt.net_pnl) });
        }
        if (opt.close_date > optionTerminalDate) optionTerminalDate = opt.close_date;
    }
    const optStats = calculateStats('Options', options.map(r => r.net_pnl), optionTickerCount.n, optionReturns, optMaxDD);
    optStats.benchmarkAlpha = optionsAlpha;
    optStats.mwr = calculateMWR(optionCashflows, 0, optionTerminalDate);
    stats.push(optStats);

    // 2. Equities Stats
    const equities = db.prepare(`SELECT net_pnl, open_date, close_date, open_price, qty FROM alpha_equity_trades WHERE close_date IS NOT NULL`).all() as any[];
    const equityTickerCount = db.prepare(`SELECT COUNT(DISTINCT instrument) as n FROM alpha_equity_trades WHERE close_date IS NOT NULL`).get() as { n: number };
    
    let equitiesAlpha = 0;
    const equityCashflows: { date: string, amount: number }[] = [];
    const equityReturns: number[] = [];
    let equityTerminalDate = equities.length > 0 ? equities[0].close_date : '';

    for (const eq of equities) {
        const vtiOpen = getClosestVtiPrice(eq.open_date, vtiMap, sortedVtiDates);
        const vtiClose = getClosestVtiPrice(eq.close_date, vtiMap, sortedVtiDates);
        if (vtiOpen > 0 && vtiClose > 0) {
            const capitalInvested = eq.open_price * eq.qty;
            const vtiShares = capitalInvested / vtiOpen;
            const vtiPnL = vtiShares * (vtiClose - vtiOpen);
            equitiesAlpha += (eq.net_pnl - vtiPnL);
        } else {
            equitiesAlpha += eq.net_pnl;
        }

        const capital = eq.open_price * eq.qty;
        if (capital > 0) {
            equityReturns.push(eq.net_pnl / capital);
        }

        // MWR: Treat every trade open as negative cash flow (outflow)
        equityCashflows.push({ date: eq.open_date, amount: eq.open_price * eq.qty });
        // Close as positive cash flow (inflow/negative deposit)
        equityCashflows.push({ date: eq.close_date, amount: -(eq.open_price * eq.qty + eq.net_pnl) });
        
        if (eq.close_date > equityTerminalDate) equityTerminalDate = eq.close_date;
    }
    const eqStats = calculateStats('Equities', equities.map(r => r.net_pnl), equityTickerCount.n, equityReturns, eqMaxDD);
    eqStats.benchmarkAlpha = equitiesAlpha;
    eqStats.mwr = calculateMWR(equityCashflows, 0, equityTerminalDate);
    stats.push(eqStats);

    // 3. Futures Stats
    const futureSettlements = db.prepare(`
        SELECT activity_date, SUM(amount) as amount 
        FROM alpha_transactions 
        WHERE trans_code = 'FUTSWP' 
        GROUP BY activity_date 
        ORDER BY activity_date
    `).all() as { amount: number }[];
    const futPnls = futureSettlements.map(r => r.amount);
    const futMaxDD = calculateMaxDrawdownFromPnl(futPnls);
    
    const futureTickerCount = db.prepare(`SELECT COUNT(DISTINCT instrument) as n FROM alpha_transactions WHERE trans_code = 'FUTSWP' AND instrument IS NOT NULL AND instrument != ''`).get() as { n: number };
    const futStats = calculateStats('Futures', futPnls, futureTickerCount.n || 0, futPnls, futMaxDD);
    futStats.benchmarkAlpha = futStats.totalNetPnl;
    futStats.mwr = 0;
    stats.push(futStats);

    return stats;
}

export interface TradeLogEntry {
    date: string;
    instrument: string;
    direction: string;
    entry: number;
    exit: number;
    hold: number;
    pnl: number;
    pct: number;
    strike?: number;
    expiry?: string;
    optionType?: string;
}

export async function getTradeLog(type: 'Futures' | 'Options' | 'Equities'): Promise<TradeLogEntry[]> {
    if (type === 'Futures') {
        const trades = db.prepare(`
            SELECT 
                close_date as date,
                symbol || ' ' || contract_month as instrument,
                direction,
                open_price as entry,
                close_price as exit,
                hold_days as hold,
                net_pnl as pnl,
                CASE 
                    WHEN direction = 'LONG' THEN (close_price - open_price) / open_price
                    ELSE (open_price - close_price) / open_price
                END as pct
            FROM alpha_futures_trades
            ORDER BY close_date DESC
        `).all() as TradeLogEntry[];

        if (trades.length > 0) return trades;

        const sweeps = db.prepare(`
            SELECT 
                activity_date as date,
                'Futures Sweep' as instrument,
                CASE WHEN amount >= 0 THEN 'GAIN' ELSE 'LOSS' END as direction,
                0 as entry,
                0 as exit,
                0 as hold,
                amount as pnl,
                0 as pct
            FROM alpha_transactions
            WHERE trans_code = 'FUTSWP'
            ORDER BY activity_date DESC
        `).all() as TradeLogEntry[];
        return sweeps;
    }

    if (type === 'Options') {
        return db.prepare(`
            SELECT 
                close_date as date,
                instrument,
                strike,
                expiry,
                option_type as optionType,
                direction,
                ABS(open_premium) as entry,
                ABS(close_premium) as exit,
                hold_days as hold,
                net_pnl as pnl,
                CASE 
                    WHEN ABS(open_premium) > 0 THEN net_pnl / ABS(open_premium)
                    ELSE 0
                END as pct
            FROM alpha_option_trades
            WHERE close_date IS NOT NULL
            ORDER BY close_date DESC
        `).all() as TradeLogEntry[];
    }

    if (type === 'Equities') {
        return db.prepare(`
            SELECT 
                close_date as date,
                instrument,
                'LONG' as direction,
                open_price as entry,
                close_price as exit,
                hold_days as hold,
                net_pnl as pnl,
                (close_price - open_price) / open_price as pct
            FROM alpha_equity_trades
            WHERE close_date IS NOT NULL
            ORDER BY close_date DESC
        `).all() as TradeLogEntry[];
    }

    return [];
}

function calculateStats(
    book: string, 
    pnls: number[], 
    distinctTickerCount: number,
    returns: number[] = [],
    maxDrawdown: number = 0
): BookTradeStats {
    if (pnls.length === 0) {
        return {
            book, totalTrades: 0, distinctTickerCount: 0, winRate: 0, profitFactor: 0, expectedValue: 0,
            avgWin: 0, avgLoss: 0, maxWin: 0, maxLoss: 0, totalNetPnl: 0, benchmarkAlpha: 0,
            mwr: 0, sharpeRatio: 0, calmarRatio: 0
        };
    }

    const wins = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);
    const totalNetPnl = pnls.reduce((a, b) => a + b, 0);

    const grossGains = wins.reduce((a, b) => a + b, 0);
    const grossLosses = Math.abs(losses.reduce((a, b) => a + b, 0));

    // Refined Sharpe
    let sharpeRatio = 0;
    if (returns.length > 0) {
        const vol = calculateSeriesVolatility(returns);
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        sharpeRatio = vol > 0 ? (meanReturn * 252) / vol : 0;
    } else {
        // Fallback to trade-level Sharpe if no returns series provided
        const mean = totalNetPnl / pnls.length;
        const variance = pnls.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pnls.length;
        const stdDev = Math.sqrt(variance);
        sharpeRatio = stdDev > 0 ? mean / stdDev : 0;
    }

    // Refined Calmar: Net Profit / Max Drawdown
    const calmarRatio = maxDrawdown > 0 ? totalNetPnl / maxDrawdown : 0;

    return {
        book,
        totalTrades: pnls.length,
        distinctTickerCount,
        winRate: wins.length / pnls.length,
        profitFactor: grossLosses > 0 ? grossGains / grossLosses : grossGains > 0 ? Infinity : 0,
        expectedValue: totalNetPnl / pnls.length,
        avgWin: wins.length > 0 ? grossGains / wins.length : 0,
        avgLoss: losses.length > 0 ? grossLosses / losses.length : 0,
        maxWin: wins.length > 0 ? Math.max(...wins) : 0,
        maxLoss: losses.length > 0 ? Math.min(...losses) : 0,
        totalNetPnl,
        benchmarkAlpha: 0,
        mwr: 0,
        sharpeRatio,
        calmarRatio
    };
}

export async function getAlphaNavSeries(): Promise<{ date: string, nav: number }[]> {
    const rows = db.prepare(`
        SELECT date, nav\n        FROM alpha_daily_pnl
        ORDER BY date
    `).all() as { date: string, nav: number }[];

    if (rows.length === 0) return [];

    const firstDate = rows[0].date;
    const firstMonth = firstDate.substring(0, 7);
    const snapshot = db.prepare('SELECT opening_balance FROM alpha_nav_snapshots WHERE month <= ? ORDER BY month DESC LIMIT 1').get(firstMonth) as { opening_balance: number } | undefined;

    const startingNav = snapshot ? snapshot.opening_balance : 0;
    
    return rows.map(row => ({ date: row.date, nav: row.nav + startingNav }));
}
