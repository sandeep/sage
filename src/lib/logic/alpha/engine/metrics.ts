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
    // Execution Parity
    winRate: number;
    profitFactor: number;
    expectedValue: number;
    avgWin: number;
    avgLoss: number;
    vtiTwr?: number; // Benchmark Parity
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
    // Performance Parity
    twr: number;
    sharpeRatio: number;
    calmarRatio: number;
    volatility: number;
    maxDrawdown: number;
    cvar95: number;
    vtiTwr?: number; // Benchmark Parity
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

function calculateSeriesVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    return Math.sqrt(variance * 252);
}

export async function calculateAlphaMetrics(startDate?: string, endDate?: string): Promise<AlphaMetrics> {
    const settings = getStrategicSettings();
    const rf = settings.risk_free_rate;

    let query = `
        SELECT 
            date,
            daily_total as pnl,
            deposits,
            cumulative_pnl,
            nav
        FROM alpha_daily_pnl
    `;

    const params: any[] = [];
    if (startDate && endDate) {
        query += ` WHERE date >= ? AND date <= ?`;
        params.push(startDate, endDate);
    }

    query += ` ORDER BY date`;

    const rows = db.prepare(query).all(...params) as { date: string, pnl: number, deposits: number, cumulative_pnl: number, nav: number }[];

    if (rows.length === 0) {
        return {
            totalPnl: 0, totalDeposited: 0, netReturnPct: 0, twr: 0, annualizedReturn: 0,
            volatility: 0, sharpeRatio: 0, sortinoRatio: 0, informationRatio: 0,
            calmarRatio: 0, maxDrawdown: 0, cvar95: 0, dollarAlpha: 0, shadowNav: 0, mwr: 0,
            winRate: 0, profitFactor: 0, expectedValue: 0, avgWin: 0, avgLoss: 0, vtiTwr: 0
        };
    }

    const firstDate = rows[0].date;
    const anchorRow = db.prepare(`
        SELECT nav FROM alpha_daily_pnl WHERE date < ? ORDER BY date DESC LIMIT 1
    `).get(firstDate) as { nav: number } | undefined;

    const shadowAnchorRow = db.prepare(`
        SELECT value FROM alpha_shadow_vti WHERE date < ? ORDER BY date DESC LIMIT 1
    `).get(firstDate) as { value: number } | undefined;

    let currentNav = anchorRow ? anchorRow.nav : 0;

    let totalPnl = 0;
    let totalDeposited = 0;
    const dailyReturns: number[] = [];
    const alphaReturns: number[] = [];

    const { getVtiBenchmarkData } = await import('./benchmark');
    const benchmarkData = await getVtiBenchmarkData(startDate, endDate);
    const benchmarkMap = new Map(benchmarkData.map(b => [b.date, b.dailyReturn]));
    const vtiTwr = benchmarkData.reduce((acc, b) => acc * (1 + b.dailyReturn), 1) - 1;

    let peakNav = currentNav;
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
    const cvar95 = worst5Pct.reduce((a, b) => a + b, 0) / (worst5Pct.length || 1);

    const lastDate = rows[rows.length - 1].date;
    const shadowEndRow = db.prepare(`SELECT value FROM alpha_shadow_vti WHERE date <= ? ORDER BY date DESC LIMIT 1`).get(lastDate) as { value: number } | undefined;
    const shadowNav = shadowEndRow ? shadowEndRow.value : 0;
    const dollarAlpha = currentNav - shadowNav;

    const cashflows = rows.filter(r => r.deposits !== 0).map(r => ({ date: r.date, amount: r.deposits }));
    if (anchorRow && anchorRow.nav > 0) {
        cashflows.unshift({ date: firstDate, amount: anchorRow.nav });
    }
    
    const terminalDate = rows.length > 0 ? rows[rows.length - 1].date : new Date().toISOString().split('T')[0];
    const mwr = calculateMWR(cashflows, currentNav, terminalDate);

    // Aggregate Execution Stats
    const pnlWins = rows.filter(r => r.pnl > 0);
    const pnlLosses = rows.filter(r => r.pnl < 0);
    const grossGains = pnlWins.reduce((a, b) => a + b.pnl, 0);
    const grossLosses = Math.abs(pnlLosses.reduce((a, b) => a + b.pnl, 0));

    return {
        totalPnl, totalDeposited, netReturnPct: totalDeposited > 0 ? totalPnl / totalDeposited : 0,
        twr, annualizedReturn, volatility, sharpeRatio, sortinoRatio, informationRatio,
        calmarRatio, maxDrawdown, cvar95, dollarAlpha, shadowNav, mwr,
        winRate: pnlWins.length / (pnlWins.length + pnlLosses.length || 1),
        profitFactor: grossLosses > 0 ? grossGains / grossLosses : grossGains > 0 ? Infinity : 0,
        expectedValue: totalPnl / (rows.length || 1),
        avgWin: pnlWins.length > 0 ? grossGains / pnlWins.length : 0,
        avgLoss: pnlLosses.length > 0 ? grossLosses / pnlLosses.length : 0,
        vtiTwr
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

export async function getBookTradeStats(startDate?: string, endDate?: string): Promise<BookTradeStats[]> {
    const stats: BookTradeStats[] = [];
    const vtiMap = getVtiPriceMap();
    const sortedVtiDates = Array.from(vtiMap.keys()).sort();
    const settings = getStrategicSettings();
    const rf = settings.risk_free_rate;

    const { getVtiBenchmarkData } = await import('./benchmark');
    const benchmarkData = await getVtiBenchmarkData(startDate, endDate);
    const vtiTwr = benchmarkData.reduce((acc, b) => acc * (1 + b.dailyReturn), 1) - 1;

    const dateFilterWhere = startDate && endDate ? `WHERE date >= ? AND date <= ?` : '';
    const dateFilterParams = startDate && endDate ? [startDate, endDate] : [];

    const dateFilterClose = startDate && endDate ? `AND close_date >= ? AND close_date <= ?` : '';
    const dateFilterCloseParams = startDate && endDate ? [startDate, endDate] : [];

    const dateFilterActivity = startDate && endDate ? `AND activity_date >= ? AND activity_date <= ?` : '';
    const dateFilterActivityParams = startDate && endDate ? [startDate, endDate] : [];

    const dailyBookPnls = db.prepare(`
        SELECT 
            date, 
            options_pnl as opt, 
            equity_pnl as eq, 
            futures_pnl as fut,
            nav
        FROM alpha_daily_pnl 
        ${dateFilterWhere} 
        ORDER BY date
    `).all(...dateFilterParams) as any[];

    const getSeriesMetrics = (pnlField: string) => {
        const returns: number[] = [];
        let peak = 0;
        let cumulative = 0;
        let maxDD = 0;
        
        dailyBookPnls.forEach((row, i) => {
            const pnl = row[pnlField] || 0;
            const prevNav = i > 0 ? dailyBookPnls[i-1].nav : 0;
            returns.push(prevNav > 0 ? pnl / prevNav : 0);
            
            cumulative += pnl;
            if (cumulative > peak) peak = cumulative;
            const dd = peak > 0 ? (peak - cumulative) / peak : 0;
            if (dd > maxDD) maxDD = dd;
        });

        const twr = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
        const vol = calculateSeriesVolatility(returns);
        const sorted = [...returns].sort((a, b) => a - b);
        const worst5 = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.05)));
        const cvar = worst5.reduce((a, b) => a + b, 0) / (worst5.length || 1);

        return { twr, vol, maxDD, cvar, returns };
    };

    // 1. Options Stats
    const optSeries = getSeriesMetrics('opt');
    const options = db.prepare(`SELECT open_date, close_date, net_pnl, strike, open_qty, open_premium, hold_days FROM alpha_option_trades WHERE close_date IS NOT NULL ${dateFilterClose}`).all(...dateFilterCloseParams) as any[];
    const optionTickerCount = db.prepare(`SELECT COUNT(DISTINCT instrument) as n FROM alpha_option_trades WHERE close_date IS NOT NULL ${dateFilterClose}`).get(...dateFilterCloseParams) as { n: number };
    
    let optionsAlpha = 0;
    const optionCashflows: { date: string, amount: number }[] = [];
    let optionTerminalDate = options.length > 0 ? options[0].close_date : '';

    for (const opt of options) {
        const notional = (opt.strike || 0) * 100 * Math.abs(opt.open_qty || 1);
        const holdDays = opt.hold_days || 0;
        const cashReturn = notional * (rf / 365) * holdDays;
        optionsAlpha += (opt.net_pnl - cashReturn);

        const premium = Math.abs(opt.open_premium);
        if (premium > 0) {
            optionCashflows.push({ date: opt.open_date, amount: premium });
            optionCashflows.push({ date: opt.close_date, amount: -(premium + opt.net_pnl) });
        }
        if (opt.close_date > optionTerminalDate) optionTerminalDate = opt.close_date;
    }
    const optStats = calculateStats('Options', options.map(r => r.net_pnl), optionTickerCount.n, optSeries.returns, optSeries.maxDD);
    optStats.benchmarkAlpha = optionsAlpha;
    optStats.mwr = calculateMWR(optionCashflows, 0, optionTerminalDate);
    optStats.twr = optSeries.twr;
    optStats.volatility = optSeries.vol;
    optStats.cvar95 = optSeries.cvar;
    optStats.maxDrawdown = optSeries.maxDD;
    optStats.vtiTwr = vtiTwr;
    stats.push(optStats);

    // 2. Equities Stats
    const eqSeries = getSeriesMetrics('eq');
    const equities = db.prepare(`SELECT net_pnl, open_date, close_date, open_price, qty FROM alpha_equity_trades WHERE close_date IS NOT NULL ${dateFilterClose}`).all(...dateFilterCloseParams) as any[];
    const equityTickerCount = db.prepare(`SELECT COUNT(DISTINCT instrument) as n FROM alpha_equity_trades WHERE close_date IS NOT NULL ${dateFilterClose}`).get(...dateFilterCloseParams) as { n: number };
    
    let equitiesAlpha = 0;
    const equityCashflows: { date: string, amount: number }[] = [];
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

        equityCashflows.push({ date: eq.open_date, amount: eq.open_price * eq.qty });
        equityCashflows.push({ date: eq.close_date, amount: -(eq.open_price * eq.qty + eq.net_pnl) });
        if (eq.close_date > equityTerminalDate) equityTerminalDate = eq.close_date;
    }
    const eqStats = calculateStats('Equities', equities.map(r => r.net_pnl), equityTickerCount.n, eqSeries.returns, eqSeries.maxDD);
    eqStats.benchmarkAlpha = equitiesAlpha;
    eqStats.mwr = calculateMWR(equityCashflows, 0, equityTerminalDate);
    eqStats.twr = eqSeries.twr;
    eqStats.volatility = eqSeries.vol;
    eqStats.cvar95 = eqSeries.cvar;
    eqStats.maxDrawdown = eqSeries.maxDD;
    eqStats.vtiTwr = vtiTwr;
    stats.push(eqStats);

    // 3. Futures Stats
    const futSeries = getSeriesMetrics('fut');
    const futureTransactions = db.prepare(`
        SELECT activity_date, amount 
        FROM alpha_transactions 
        WHERE trans_code = 'FUTSWP' ${dateFilterActivity}
        ORDER BY activity_date
    `).all(...dateFilterActivityParams) as { amount: number }[];
    const futPnls = futureTransactions.map(r => r.amount);
    
    const futureTickerCount = db.prepare(`SELECT COUNT(DISTINCT instrument) as n FROM alpha_transactions WHERE trans_code = 'FUTSWP' AND instrument IS NOT NULL AND instrument != '' ${dateFilterActivity}`).get(...dateFilterActivityParams) as { n: number };
    const futStats = calculateStats('Futures', futPnls, futureTickerCount.n || 0, futSeries.returns, futSeries.maxDD);
    futStats.benchmarkAlpha = futStats.totalNetPnl;
    futStats.mwr = 0;
    futStats.twr = futSeries.twr;
    futStats.volatility = futSeries.vol;
    futStats.cvar95 = futSeries.cvar;
    futStats.maxDrawdown = futSeries.maxDD;
    futStats.vtiTwr = vtiTwr;
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

export async function getTradeLog(type: 'Futures' | 'Options' | 'Equities', startDate?: string, endDate?: string): Promise<TradeLogEntry[]> {
    const dateFilterClose = startDate && endDate ? `AND close_date >= ? AND close_date <= ?` : '';
    const dateFilterActivity = startDate && endDate ? `AND activity_date >= ? AND activity_date <= ?` : '';
    const dateFilterParams = startDate && endDate ? [startDate, endDate] : [];

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
            WHERE 1=1 ${dateFilterClose}
            ORDER BY close_date DESC
        `).all(...dateFilterParams) as TradeLogEntry[];

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
            WHERE trans_code = 'FUTSWP' ${dateFilterActivity}
            ORDER BY activity_date DESC
        `).all(...dateFilterParams) as TradeLogEntry[];
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
            WHERE close_date IS NOT NULL ${dateFilterClose}
            ORDER BY close_date DESC
        `).all(...dateFilterParams) as TradeLogEntry[];
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
            WHERE close_date IS NOT NULL ${dateFilterClose}
            ORDER BY close_date DESC
        `).all(...dateFilterParams) as TradeLogEntry[];
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
            mwr: 0, twr: 0, sharpeRatio: 0, calmarRatio: 0, volatility: 0, maxDrawdown: 0, cvar95: 0
        };
    }

    const wins = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);
    const totalNetPnl = pnls.reduce((a, b) => a + b, 0);

    const grossGains = wins.reduce((a, b) => a + b, 0);
    const grossLosses = Math.abs(losses.reduce((a, b) => a + b, 0));

    let sharpeRatio = 0;
    if (returns.length > 0) {
        const vol = calculateSeriesVolatility(returns);
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        sharpeRatio = vol > 0 ? (meanReturn * 252) / vol : 0;
    } else {
        const mean = totalNetPnl / pnls.length;
        const variance = pnls.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pnls.length;
        const stdDev = Math.sqrt(variance);
        sharpeRatio = stdDev > 0 ? mean / stdDev : 0;
    }

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
        twr: 0,
        sharpeRatio,
        calmarRatio,
        volatility: 0,
        maxDrawdown: 0,
        cvar95: 0
    };
}
export async function getAlphaNavSeries(startDate?: string, endDate?: string): Promise<{ date: string, nav: number }[]> {
    let query = `
        SELECT date, nav
        FROM alpha_daily_pnl
    `;

    const params: any[] = [];
    if (startDate && endDate) {
        query += ` WHERE date >= ? AND date <= ?`;
        params.push(startDate, endDate);
    }

    query += ` ORDER BY date`;

    const rows = db.prepare(query).all(...params) as { date: string, nav: number }[];

    if (rows.length === 0) return [];


    const firstDate = rows[0].date;
    const firstMonth = firstDate.substring(0, 7);
    const snapshot = db.prepare('SELECT opening_balance FROM alpha_nav_snapshots WHERE month <= ? ORDER BY month DESC LIMIT 1').get(firstMonth) as { opening_balance: number } | undefined;

    const startingNav = snapshot ? snapshot.opening_balance : 0;
    
    return rows.map(row => ({ date: row.date, nav: row.nav + startingNav }));
}
