// src/lib/data/scrape_etf_holdings.ts
// Scrapes top ETF holdings from stockanalysis.com and populates etf_composition.
// Mutual funds that can't be scraped directly are mapped to an ETF proxy tracking the same index.
// Run manually: npx tsx src/lib/data/scrape_etf_holdings.ts

import db from '../db/client';

const HOLDINGS_TO_FETCH = 50; // top N holdings per fund (enough to catch >5% positions)
const DELAY_MS = 1500; // be polite

// Bond ETF proxies — no equity look-through needed; scrape returns 0 rows.
// FXNAX → BND (Fidelity U.S. Bond Index). Skip silently.
const BOND_PROXIES = new Set(['BND', 'AGG', 'TLT', 'SHY', 'IEF', 'IEI', 'TIP', 'VCIT', 'VCSH']);

// Mutual funds → ETF proxy mapping (same underlying index, scrapeable on stockanalysis.com)
const ETF_PROXY: Record<string, string> = {
    // Total US Stock Market
    FZROX: 'VTI', FSKAX: 'VTI',
    // US Large Cap / S&P 500
    FXAIX: 'IVV', VIIIX: 'IVV', VINIX: 'IVV', VFINX: 'IVV', VFFSX: 'IVV', VFIAX: 'IVV', PREIX: 'IVV',
    // Developed International
    FSPSX: 'VEA',
    // Emerging Markets
    FPADX: 'VWO',
    // REIT
    FSRNX: 'VNQ',
    // Total Bond
    FXNAX: 'BND',
    // Extended Market / Small-Mid Blend
    FZIPX: 'VXF', VIEIX: 'VXF',
    // Healthcare
    VGHAX: 'VHT',
    // Small Cap Value
    VSIAX: 'VBR',
    // Total International
    VTSAX: 'VTI', // VTSAX is total market, use VTI
};

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeHoldings(ticker: string): Promise<{ asset: string; weight: number }[]> {
    const url = `https://stockanalysis.com/etf/${ticker.toLowerCase()}/holdings/`;
    console.log(`  Fetching ${url}`);

    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });

    if (!res.ok) {
        console.warn(`  HTTP ${res.status} for ${ticker}`);
        return [];
    }

    const html = await res.text();

    const holdings: { asset: string; weight: number }[] = [];

    // Match both US stocks (/stocks/TICKER/) and international (/quote/EXCHANGE/TICKER/)
    // then extract the weight from the next <td> containing a percentage
    const rowRegex = /<a href="\/(?:stocks|quote\/[^/]+)\/([^/"]+)\/"[^>]*>(?:[^<]*: )?([A-Z0-9.]+)<\/a>[\s\S]*?<td[^>]*>([\d.]+)%<\/td>/g;
    let match;
    while ((match = rowRegex.exec(html)) !== null && holdings.length < HOLDINGS_TO_FETCH) {
        // match[2] is the display ticker (e.g. "ASML" from "AMS: ASML")
        const asset = match[2];
        const weight = parseFloat(match[3]) / 100;
        if (asset && weight > 0) {
            holdings.push({ asset, weight });
        }
    }

    // Fallback: simpler pattern
    if (holdings.length === 0) {
        const simpleRegex = />(?:[A-Z]+:\s+)?([A-Z]{1,6})<\/a>[\s\S]{0,300}?([\d.]+)%/g;
        while ((match = simpleRegex.exec(html)) !== null && holdings.length < HOLDINGS_TO_FETCH) {
            const asset = match[1];
            const weight = parseFloat(match[2]) / 100;
            if (asset && weight > 0.0001) {
                holdings.push({ asset, weight });
            }
        }
    }

    return holdings;
}

async function populateEtfComposition(ticker: string): Promise<number> {
    // Bond funds have no equity holdings — skip without scraping.
    const proxy = ETF_PROXY[ticker] ?? ticker;
    if (BOND_PROXIES.has(proxy)) {
        console.log(`  ${ticker}: bond fund (proxy ${proxy}) — skipping`);
        return 0;
    }

    // Check freshness — also verify we have a meaningful number of rows
    const existing = db.prepare(
        `SELECT fetched_at, COUNT(*) as n FROM etf_composition WHERE fund_ticker = ?`
    ).get(ticker) as { fetched_at: string | null; n: number } | undefined;

    if (existing?.fetched_at && existing.n > 5) {
        const age = Date.now() - new Date(existing.fetched_at).getTime();
        const days = age / (1000 * 60 * 60 * 24);
        if (days < 30) {
            console.log(`  ${ticker}: fresh (${days.toFixed(0)}d old, ${existing.n} rows) — skipping`);
            return 0;
        }
    }

    // VTIVX: fund-of-funds — blend VTI (47.7%) + VEA (34.5%), skip bonds
    if (ticker === 'VTIVX') {
        const vtiH = await scrapeHoldings('VTI');
        await sleep(DELAY_MS);
        const veaH = await scrapeHoldings('VEA');
        const blended: Record<string, number> = {};
        for (const h of vtiH) blended[h.asset] = (blended[h.asset] ?? 0) + h.weight * 0.477;
        for (const h of veaH) blended[h.asset] = (blended[h.asset] ?? 0) + h.weight * 0.345;
        const top50 = Object.entries(blended).sort((a, b) => b[1] - a[1]).slice(0, 50);
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const ins2 = db.prepare(`INSERT OR REPLACE INTO etf_composition (fund_ticker, asset_ticker, weight, fetched_at) VALUES (?, ?, ?, ?)`);
        db.transaction(() => {
            db.prepare('DELETE FROM etf_composition WHERE fund_ticker = ?').run('VTIVX');
            top50.forEach(([t, w]) => ins2.run('VTIVX', t, w, now));
        })();
        console.log(`  VTIVX: stored ${top50.length} blended holdings (VTI×47.7% + VEA×34.5%)`);
        return top50.length;
    }

    // Use ETF proxy if this is a mutual fund with no direct scrape page
    const scrapeTicker = ETF_PROXY[ticker] ?? ticker;
    if (scrapeTicker !== ticker) {
        console.log(`  ${ticker}: using ETF proxy ${scrapeTicker} (same index)`);
    }

    const holdings = await scrapeHoldings(scrapeTicker);
    if (holdings.length === 0) {
        console.warn(`  ${ticker}: no holdings found`);
        return 0;
    }

    const del = db.prepare('DELETE FROM etf_composition WHERE fund_ticker = ?');
    const ins = db.prepare(
        `INSERT OR REPLACE INTO etf_composition (fund_ticker, asset_ticker, weight, fetched_at)
         VALUES (?, ?, ?, datetime('now'))`
    );

    db.transaction(() => {
        del.run(ticker);
        for (const h of holdings) {
            ins.run(ticker, h.asset, h.weight);
        }
    })();

    console.log(`  ${ticker}: stored ${holdings.length} holdings`);
    return holdings.length;
}

async function main() {
    // Get all held ETF/FUND tickers from the DB
    const heldFunds = db.prepare(`
        SELECT DISTINCT h.ticker
        FROM holdings h
        JOIN asset_registry ar ON h.ticker = ar.ticker
        WHERE ar.asset_type IN ('ETF', 'FUND', 'MUTUAL_FUND')
        ORDER BY h.ticker
    `).all() as { ticker: string }[];

    if (heldFunds.length === 0) {
        console.log('No ETF/FUND holdings found in DB. Import holdings first.');
        process.exit(0);
    }

    console.log(`Scraping holdings for ${heldFunds.length} funds: ${heldFunds.map(f => f.ticker).join(', ')}`);

    let total = 0;
    for (const { ticker } of heldFunds) {
        console.log(`\n[${ticker}]`);
        const count = await populateEtfComposition(ticker);
        total += count;
        if (count > 0) await sleep(DELAY_MS);
    }

    console.log(`\nDone. Total holdings stored: ${total}`);

    // Verify
    const summary = db.prepare(
        `SELECT fund_ticker, COUNT(*) as n FROM etf_composition GROUP BY fund_ticker`
    ).all() as { fund_ticker: string; n: number }[];
    console.log('etf_composition summary:', summary);
}

main().catch(console.error);
