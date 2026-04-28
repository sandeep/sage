// One-time script to seed VTIVX composition from VTI + VEA blend
// VTIVX (Target 2045) composition: 47.7% US stock, 34.5% intl stock, 17.8% bonds
// Run: npx tsx src/lib/data/seed_vtivx.ts

import db from '../db/client';

const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
const ins = db.prepare(
    'INSERT OR REPLACE INTO etf_composition (fund_ticker, asset_ticker, weight, fetched_at) VALUES (?, ?, ?, ?)'
);

async function scrapeEtf(ticker: string): Promise<{ asset: string; weight: number }[]> {
    const url = `https://stockanalysis.com/etf/${ticker.toLowerCase()}/holdings/`;
    console.log(`Scraping ${url}...`);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const holdings: { asset: string; weight: number }[] = [];
    const re = /<a href="\/(?:stocks|quote\/[^/]+)\/[^/"]+\/"[^>]*>(?:[^<]*: )?([A-Z0-9.]+)<\/a>[\s\S]*?<td[^>]*>([\d.]+)%<\/td>/g;
    let m;
    while ((m = re.exec(html)) !== null && holdings.length < 50) {
        holdings.push({ asset: m[1], weight: parseFloat(m[2]) / 100 });
    }
    // Store under ETF ticker too
    db.prepare('DELETE FROM etf_composition WHERE fund_ticker = ?').run(ticker);
    db.transaction(() => holdings.forEach(h => ins.run(ticker, h.asset, h.weight, now)))();
    console.log(`  ${ticker}: ${holdings.length} rows`);
    return holdings;
}

async function main() {
    const vtiHoldings = await scrapeEtf('VTI');
    await new Promise(r => setTimeout(r, 1500));
    const veaHoldings = await scrapeEtf('VEA');

    // Blend: 47.7% VTI + 34.5% VEA (bonds 17.8% skipped — no equity holdings)
    const blended: Record<string, number> = {};
    for (const h of vtiHoldings) blended[h.asset] = (blended[h.asset] ?? 0) + h.weight * 0.477;
    for (const h of veaHoldings) blended[h.asset] = (blended[h.asset] ?? 0) + h.weight * 0.345;

    db.prepare('DELETE FROM etf_composition WHERE fund_ticker = ?').run('VTIVX');
    const top50 = Object.entries(blended).sort((a, b) => b[1] - a[1]).slice(0, 50);
    db.transaction(() => top50.forEach(([t, w]) => ins.run('VTIVX', t, w, now)))();

    console.log(`\nVTIVX: stored ${top50.length} blended holdings`);
    console.log('Top 5:', top50.slice(0, 5).map(([t, w]) => `${t} ${(w * 100).toFixed(2)}%`).join(', '));
}

main().catch(console.error);
