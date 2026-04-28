// src/lib/logic/alpha/engine/benchmark.ts
import db from '@/lib/db/client';

export interface BenchmarkData {
    date: string;
    nav: number;
    dailyReturn: number;
}

/**
 * Constructs a hypothetical VTI portfolio with identical starting capital and deposit timing.
 * daily_nav_vti[t] = daily_nav_vti[t-1] * (price_vti[t] / price_vti[t-1]) + deposits[t]
 */
export async function getVtiBenchmarkData(): Promise<BenchmarkData[]> {
    const alphaRows = db.prepare('SELECT date, deposits FROM alpha_daily_pnl ORDER BY date').all() as { date: string, deposits: number }[];
    
    if (alphaRows.length === 0) return [];

    const ticker = 'VTI';
    const priceRows = db.prepare('SELECT date, close FROM price_history WHERE ticker = ? ORDER BY date').all(ticker) as { date: string, close: number }[];
    const priceMap = new Map(priceRows.map(r => [r.date, r.close]));

    let currentNav = 0;
    let prevPrice = 0;
    const benchmarkData: BenchmarkData[] = [];

    for (const row of alphaRows) {
        const currentPrice = priceMap.get(row.date);
        
        let dailyReturn = 0;
        if (prevPrice > 0 && currentPrice) {
            dailyReturn = (currentPrice / prevPrice) - 1;
        }

        // nav[t] = nav[t-1] * (1 + r) + deposits[t]
        // This assumes deposits happen at the END of the day (not participating in that day's return)
        currentNav = currentNav * (1 + dailyReturn) + row.deposits;

        benchmarkData.push({
            date: row.date,
            nav: currentNav,
            dailyReturn
        });

        if (currentPrice) {
            prevPrice = currentPrice;
        }
    }

    return benchmarkData;
}
