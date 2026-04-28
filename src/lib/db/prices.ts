// src/lib/db/prices.ts
import db from './client';

/** Returns the latest closing price for a ticker, or null if no data. */
export function getLatestPrice(ticker: string): number | null {
    const row = db.prepare(`
        SELECT close FROM price_history WHERE ticker = ? ORDER BY date DESC LIMIT 1
    `).get(ticker) as { close: number } | undefined;
    return row?.close ?? null;
}

/** Returns all ticker weights from asset_registry. */
export function getTickerMap(): Record<string, { canonical: string; weights: Record<string, number> }> {
    const rows = db.prepare(`SELECT ticker, canonical, weights FROM asset_registry`).all() as { ticker: string; canonical: string; weights: string }[];
    const map: Record<string, { canonical: string; weights: Record<string, number> }> = {};
    for (const row of rows) {
        map[row.ticker] = { canonical: row.canonical, weights: JSON.parse(row.weights) };
    }
    return map;
}
