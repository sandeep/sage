// src/lib/data/refresh.ts
// Multi-source price refresh with fallback chain:
//   1. Yahoo Finance  — no key, no daily cap, covers ETFs / stocks / mutual funds
//   2. Alpha Vantage  — 25 req/day free, good for mutual funds Yahoo misses

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import db from '../db/client';
import { ETF_PROXY_MAP } from '../logic/allocationSimulator';
import {
    yfFetch,
    yfCurrentPrice,
    yfHistoricalPrices,
    avCurrentPrice,
    avHistoricalPrices,
    sleep,
    todayStr,
    TICKER_DELAY_MS,
    HISTORY_START,
} from './priceRefresh';

export interface RefreshResult {
    updated: number;
    failed: string[];
    etfCompositionUpdated: string[];
    discovered: string[];
}

// ── Unified fetch with fallback chain ───────────────────────────────────────

type PriceRow = { date: string; close: number };
type HistoryFn = (ticker: string) => Promise<PriceRow[] | null>;

const HISTORY_SOURCES: Array<{ name: string; fn: HistoryFn }> = [
    { name: 'Yahoo', fn: yfHistoricalPrices },
    { name: 'AV',    fn: avHistoricalPrices },
];

async function fetchMetadata(ticker: string): Promise<boolean> {
    if (ticker.includes('**') || ticker === 'CASH') {
        db.prepare(`INSERT OR REPLACE INTO price_history (ticker, date, close) VALUES (?, ?, 1.0)`)
          .run(ticker, todayStr());
        return true;
    }

    // 1. Yahoo Finance (Primary for Price + 52W + Name)
    const result = await yfFetch(ticker, '5d');
    if (result?.meta) {
        const meta = result.meta;
        const price = meta.regularMarketPrice ?? meta.previousClose;
        
        if (price) {
            db.prepare(`INSERT OR REPLACE INTO price_history (ticker, date, close) VALUES (?, ?, ?)`)
              .run(ticker, todayStr(), price);
            
            // Update Ticker Meta
            db.prepare(`
                UPDATE ticker_meta 
                SET name = ?, fiftyTwoWeekLow = ?, fiftyTwoWeekHigh = ?, close = ?
                WHERE ticker = ?
            `).run(meta.longName || meta.shortName || ticker, meta.fiftyTwoWeekLow, meta.fiftyTwoWeekHigh, price, ticker);

            console.log(`  ${ticker}: updated price ${price.toFixed(2)} + metadata [Yahoo]`);
            return true;
        }
    }

    // 2. Alpha Vantage Fallback (Price only)
    const avPrice = await avCurrentPrice(ticker);
    if (avPrice != null) {
        db.prepare(`INSERT OR REPLACE INTO price_history (ticker, date, close) VALUES (?, ?, ?)`)
          .run(ticker, todayStr(), avPrice);
        db.prepare(`UPDATE ticker_meta SET close = ? WHERE ticker = ?`).run(avPrice, ticker);
        console.log(`  ${ticker}: current price ${avPrice.toFixed(2)} [AV]`);
        return true;
    }

    console.warn(`  ${ticker}: all quote sources failed`);
    return false;
}

export async function fetchPriceHistory(ticker: string): Promise<boolean> {
    if (ticker.includes('**') || ticker === 'CASH') {
        db.prepare(`INSERT OR REPLACE INTO price_history (ticker, date, close) VALUES (?, ?, 1.0)`)
          .run(ticker, todayStr());
        return true;
    }
    const existing = db.prepare(`SELECT COUNT(*) as cnt FROM price_history WHERE ticker = ?`)
      .get(ticker) as { cnt: number };
    if (existing.cnt > 5) return true; // already has history — skip

    for (const { name, fn } of HISTORY_SOURCES) {
        const rows = await fn(ticker);
        if (rows && rows.length > 0) {
            const insert = db.prepare(`INSERT OR REPLACE INTO price_history (ticker, date, close) VALUES (?, ?, ?)`);
            db.transaction(() => rows.forEach(r => insert.run(ticker, r.date, r.close)))();
            console.log(`  ${ticker}: loaded ${rows.length} history rows [${name}]`);
            return true;
        }
    }
    console.warn(`  ${ticker}: all history sources failed`);
    return false;
}

// Mutual fund → ETF proxy mapping (same index, scrapeable on stockanalysis.com)
const ETF_PROXY: Record<string, string> = {
    FZROX: 'VTI', FSKAX: 'VTI',
    FXAIX: 'IVV', VIIIX: 'IVV', VINIX: 'IVV', VFINX: 'IVV', VFFSX: 'IVV', VFIAX: 'IVV', PREIX: 'IVV',
    FSPSX: 'VEA', FPADX: 'VWO', FSRNX: 'VNQ', FXNAX: 'BND',
    FZIPX: 'VXF', VIEIX: 'VXF', VGHAX: 'VHT', VSIAX: 'VBR', VTSAX: 'VTI',
};

const BOND_PROXIES = new Set(['BND', 'AGG', 'TLT', 'SHY', 'IEF', 'IEI', 'TIP', 'VCIT', 'VCSH']);

// ─── ETF composition via scraper ──────────────────────────────────────────────

async function scrapeEtfHoldings(fundTicker: string): Promise<number> {
    const proxy = ETF_PROXY[fundTicker] ?? fundTicker;
    if (BOND_PROXIES.has(proxy)) {
        console.log(`  ${fundTicker}: bond fund (proxy ${proxy}) — skipping etf_composition`);
        return 0;
    }

    const existing = db.prepare(
        `SELECT fetched_at, COUNT(*) as n FROM etf_composition WHERE fund_ticker = ?`
    ).get(fundTicker) as { fetched_at: string | null; n: number } | undefined;

    if (existing?.fetched_at && existing.n > 5) {
        const ageDays = (Date.now() - new Date(existing.fetched_at).getTime()) / 86400000;
        if (ageDays < 30) {
            return 0; // fresh — skip silently
        }
    }

    if (proxy !== fundTicker) console.log(`  ${fundTicker}: using proxy ${proxy}`);
    const url = `https://stockanalysis.com/etf/${proxy.toLowerCase()}/holdings/`;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
        });
        if (!res.ok) { console.warn(`  ${fundTicker}: HTTP ${res.status}`); return 0; }
        const html = await res.text();

        const holdings: { asset: string; weight: number }[] = [];
        const re = /<a href="\/stocks\/[^"]+">([A-Z0-9.]+)<\/a>[\s\S]*?<td[^>]*>([\d.]+)%<\/td>/g;
        let m;
        while ((m = re.exec(html)) !== null && holdings.length < 50) {
            holdings.push({ asset: m[1], weight: parseFloat(m[2]) / 100 });
        }

        if (holdings.length === 0) { console.warn(`  ${fundTicker}: no holdings parsed`); return 0; }

        db.transaction(() => {
            db.prepare('DELETE FROM etf_composition WHERE fund_ticker = ?').run(fundTicker);
            const ins = db.prepare(
                `INSERT OR REPLACE INTO etf_composition (fund_ticker, asset_ticker, weight, fetched_at)
                 VALUES (?, ?, ?, datetime('now'))`
            );
            holdings.forEach(h => ins.run(fundTicker, h.asset, h.weight));
        })();

        console.log(`  ${fundTicker}: stored ${holdings.length} holdings`);
        return holdings.length;
    } catch (e: any) {
        console.warn(`  ${fundTicker}: scrape error — ${e?.message}`);
        return 0;
    }
}

// ─── Asset Discovery & Mapping ─────────────────────────────────────────────────

async function discoverAssets(): Promise<string[]> {
    const unmapped = db.prepare(`
        SELECT DISTINCT h.ticker 
        FROM holdings_ledger h 
        LEFT JOIN asset_registry ar ON h.ticker = ar.ticker 
        WHERE ar.ticker IS NULL
    `).all() as { ticker: string }[];

    if (unmapped.length === 0) return [];

    const discovered: string[] = [];
    const insert = db.prepare(`
        INSERT INTO asset_registry (ticker, canonical, description, asset_type, weights, is_core)
        VALUES (?, ?, ?, ?, ?, 0)
    `);

    db.transaction(() => {
        for (const { ticker } of unmapped) {
            if (!ticker) continue;
            
            let assetType = 'EQUITY';
            let weights = '{"Total Stock Market": 1.0}';
            
            if (ticker === 'CASH' || ticker.includes('**')) {
                assetType = 'EQUITY';
                weights = '{"Cash": 1.0}';
            } else if (ticker.length > 6 || ticker.includes(' ')) {
                assetType = 'OPTION';
                weights = '{"Total Stock Market": 1.0}';
            } else if (ETF_PROXY[ticker] || BOND_PROXIES.has(ticker)) {
                assetType = 'ETF';
                if (BOND_PROXIES.has(ticker) || ticker === 'FXNAX') {
                    weights = '{"US Aggregate Bond": 1.0}';
                }
            }

            // Specific mappings for known user tickers
            if (ticker === 'VMFXX' || ticker === 'VMRXX') weights = '{"Cash": 1.0}';
            if (ticker === 'FSPSX') weights = '{"Developed Market": 1.0}';
            if (ticker === 'FPADX') weights = '{"Emerging Market": 1.0}';
            if (ticker === 'FSRNX') weights = '{"REIT": 1.0}';
            if (ticker === 'VBR' || ticker === 'VSIAX' || ticker === 'IJS') weights = '{"Small Cap Value": 1.0}';
            if (ticker === 'VGHAX') weights = '{"Healthcare": 1.0}';
            if (ticker === 'FXAIX' || ticker === 'VIIIX' || ticker === 'QQQ' || ticker === 'VOO') weights = '{"US Large Cap/SP500/DJIX": 1.0}';
            if (ticker === 'VTIVX') {
                assetType = 'ETF';
                weights = '{"Total Stock Market": 0.477, "Developed Market": 0.345, "Emerging Market": 0.11, "US Aggregate Bond": 0.125, "ex-US Aggregate Bond": 0.053}';
            }

            insert.run(ticker, ticker, `Auto-discovered ${ticker}`, assetType, weights);
            discovered.push(ticker);
        }
    })();

    return discovered;
}

// ─── Return1y from stored history ─────────────────────────────────────────────

function computeReturn1y(ticker: string): void {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const yearAgoStr = yearAgo.toISOString().slice(0, 10);

    const past   = db.prepare(`SELECT close FROM price_history WHERE ticker = ? AND date <= ? ORDER BY date DESC LIMIT 1`).get(ticker, yearAgoStr) as { close: number } | undefined;
    const latest = db.prepare(`SELECT close FROM price_history WHERE ticker = ? ORDER BY date DESC LIMIT 1`).get(ticker) as { close: number } | undefined;

    if (!past || !latest || past.close === 0) return;
    const return1y = (latest.close - past.close) / past.close;
    db.prepare(`INSERT OR REPLACE INTO ticker_meta (ticker, return1y, fetched_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(ticker) DO UPDATE SET return1y = excluded.return1y, fetched_at = excluded.fetched_at`)
      .run(ticker, return1y);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export async function runRefresh(): Promise<RefreshResult> {
    const result: RefreshResult = { updated: 0, failed: [], etfCompositionUpdated: [], discovered: [] };

    // 1. Discover and Map Assets
    result.discovered = await discoverAssets();
    console.log(`Discovered ${result.discovered.length} new assets.`);

    // 2. Refresh Prices
    const heldTickers = (db.prepare(`
        SELECT DISTINCT h.ticker FROM holdings_ledger h
        UNION SELECT 'VTI'
    `).all() as { ticker: string }[]).map(r => r.ticker);

    const cashLike = heldTickers.filter(t => t.includes('**') || t === 'CASH');
    const tickerSet = new Set(heldTickers.filter(t => !t.includes('**') && t !== 'CASH'));
    Object.values(ETF_PROXY_MAP).forEach(t => tickerSet.add(t));
    const realTickers = Array.from(tickerSet);

    cashLike.forEach(t =>
        db.prepare(`INSERT OR REPLACE INTO price_history (ticker, date, close) VALUES (?, ?, 1.0)`)
          .run(t, todayStr())
    );

    console.log(`Refreshing ${realTickers.length} tickers (Yahoo → AV fallback)...`);

    for (const ticker of realTickers) {
        const ok = await fetchMetadata(ticker);
        if (ok) result.updated++; else result.failed.push(ticker);
        await sleep(TICKER_DELAY_MS);
    }

    // History for any ticker with no rows
    const needsHistory = realTickers.filter(ticker => {
        if (ticker.includes('**') || ticker === 'CASH') return false;
        const row = db.prepare(`SELECT COUNT(*) as cnt FROM price_history WHERE ticker = ?`).get(ticker) as { cnt: number };
        return row.cnt <= 1; 
    });

    if (needsHistory.length > 0) {
        console.log(`Fetching history for ${needsHistory.length} tickers...`);
        for (const ticker of needsHistory) {
            await fetchPriceHistory(ticker);
            await sleep(TICKER_DELAY_MS);
        }
    }

    realTickers.forEach(computeReturn1y);

    // 3. ETF Composition
    const heldFunds = (db.prepare(`
        SELECT DISTINCT h.ticker FROM holdings_ledger h
        JOIN asset_registry ar ON h.ticker = ar.ticker
        WHERE ar.asset_type IN ('ETF','FUND','MUTUAL_FUND')
    `).all() as { ticker: string }[]).map(r => r.ticker);

    let etfScrapeCount = 0;
    for (const ticker of heldFunds) {
        const n = await scrapeEtfHoldings(ticker);
        if (n > 0) {
            result.etfCompositionUpdated.push(ticker);
            etfScrapeCount++;
            await sleep(1500); 
        }
    }

    return result;
}
