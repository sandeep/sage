import db from '@/lib/db/client';
import { yfHistoricalPrices, sleep } from '@/lib/data/priceRefresh';

/**
 * Identifies tickers from alpha_equity_trades and alpha_option_trades 
 * that have no records in the price_history table.
 */
export function getMissingAlphaTickers(): string[] {
    const rows = db.prepare(`
        WITH alpha_tickers AS (
            SELECT DISTINCT instrument FROM alpha_equity_trades
            UNION
            SELECT DISTINCT instrument FROM alpha_option_trades
        )
        SELECT instrument 
        FROM alpha_tickers 
        WHERE instrument IS NOT NULL 
          AND instrument != ''
          AND instrument NOT IN (SELECT DISTINCT ticker FROM price_history)
    `).all() as { instrument: string }[];

    return rows.map(r => r.instrument);
}

/**
 * Backfills price history for Alpha tickers that are missing data.
 */
export async function syncAlphaPriceHistory() {
    const missing = getMissingAlphaTickers();
    console.log(`[PriceSync] Found ${missing.length} tickers missing history: ${missing.join(', ')}`);

    for (const ticker of missing) {
        console.log(`[PriceSync] Fetching history for ${ticker}...`);
        try {
            const prices = await yfHistoricalPrices(ticker);
            
            if (prices && prices.length > 0) {
                const insert = db.prepare("INSERT OR IGNORE INTO price_history (ticker, date, close) VALUES (?, ?, ?)");
                const transaction = db.transaction((rows) => {
                    for (const row of rows) {
                        insert.run(ticker, row.date, row.close);
                    }
                });
                transaction(prices);
                console.log(`[PriceSync]  --> Saved ${prices.length} rows for ${ticker}`);
            } else {
                console.warn(`[PriceSync]  --> No history found for ${ticker}`);
            }
        } catch (e: any) {
            console.error(`[PriceSync]  --> Failed to fetch history for ${ticker}: ${e.message}`);
        }

        // Avoid hitting Yahoo Finance too hard
        await sleep(500);
    }
}
