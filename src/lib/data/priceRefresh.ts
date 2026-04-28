// src/lib/data/priceRefresh.ts
// Yahoo Finance and Alpha Vantage price fetch helpers

export const AV_BASE   = 'https://www.alphavantage.co/query';
export const AV_KEY    = process.env.ALPHA_VANTAGE_API_KEY ?? '';
export const YF_BASE   = 'https://query1.finance.yahoo.com/v8/finance/chart';

export const HISTORY_START  = '2020-01-01';
export const TICKER_DELAY_MS = 400;

export function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
export function todayStr() { return new Date().toISOString().slice(0, 10); }

// ─── Source: Yahoo Finance ────────────────────────────────────────────────────

export async function yfFetch(ticker: string, range: string): Promise<any> {
    const url = `${YF_BASE}/${encodeURIComponent(ticker)}?interval=1d&range=${range}`;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data?.chart?.error) return null;
        const result = data?.chart?.result?.[0];
        return result ?? null;
    } catch {
        return null;
    }
}

export async function yfCurrentPrice(ticker: string): Promise<number | null> {
    const result = await yfFetch(ticker, '5d');
    if (!result) return null;
    const price = result.meta?.regularMarketPrice ?? result.meta?.previousClose;
    return typeof price === 'number' ? price : null;
}

export async function yfHistoricalPrices(ticker: string): Promise<{ date: string; close: number }[] | null> {
    const result = await yfFetch(ticker, '10y');
    if (!result) return null;
    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    if (timestamps.length === 0) return null;
    const rows: { date: string; close: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
        const close = closes[i];
        if (close == null) continue;
        const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
        if (date >= HISTORY_START) rows.push({ date, close });
    }
    return rows.length > 0 ? rows : null;
}

export async function yfMeta(ticker: string): Promise<any> {
    const result = await yfFetch(ticker, '5d');
    return result?.meta ?? null;
}

// ─── Source: Alpha Vantage ────────────────────────────────────────────────────

async function avGet(params: Record<string, string>): Promise<any> {
    if (!AV_KEY) return null;
    const qs = new URLSearchParams({ ...params, apikey: AV_KEY }).toString();
    try {
        const res = await fetch(`${AV_BASE}?${qs}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (data?.Note || data?.Information) {
            console.warn(`  AV rate limit: ${data.Note ?? data.Information}`);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

export async function avCurrentPrice(ticker: string): Promise<number | null> {
    const data = await avGet({ function: 'GLOBAL_QUOTE', symbol: ticker });
    const price = data?.['Global Quote']?.['05. price'];
    return price ? parseFloat(price) : null;
}

export async function avHistoricalPrices(ticker: string): Promise<{ date: string; close: number }[] | null> {
    const data = await avGet({ function: 'TIME_SERIES_DAILY', symbol: ticker, outputsize: 'full' });
    const series = data?.['Time Series (Daily)'];
    if (!series) return null;
    return Object.entries(series as Record<string, any>)
        .filter(([date]) => date >= HISTORY_START)
        .map(([date, vals]) => ({ date, close: parseFloat(vals['4. close']) }));
}
