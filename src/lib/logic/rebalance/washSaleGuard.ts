
import db from '../../db/client';
import { Directive } from '../rebalancer';

/**
 * PHASE 3: THE WASH SALE GATE
 * Scrubs proposed trades against active lockouts.
 * If a ticker is locked, it diverts the BUY to a proxy asset.
 */
export function applyWashSaleGuard(directives: Directive[]): Directive[] {
    const lockouts = db.prepare(`
        SELECT ticker FROM wash_sale_lockouts 
        WHERE locked_until > CURRENT_TIMESTAMP
    `).all() as { ticker: string }[];
    
    const lockedTickers = new Set(lockouts.map(l => l.ticker));
    if (lockedTickers.size === 0) return directives;

    return directives.map(d => {
        if (d.type !== 'BUY' && d.type !== 'REBALANCE') return d;

        // Find the target ticker in the description (e.g. "Buy $10k VTI")
        // This is a heuristic check for now; in v2.1 we will use structured trade objects.
        for (const ticker of Array.from(lockedTickers)) {
            if (d.description.includes(ticker)) {
                // Fetch proxy from asset_registry
                const proxy = db.prepare('SELECT canonical FROM asset_registry WHERE ticker = ?').get(ticker) as { canonical: string } | undefined;
                const proxyTicker = proxy?.canonical || 'CORE_PROXY'; // Fallback

                return {
                    ...d,
                    description: d.description.replace(ticker, `${proxyTicker} [WASH SALE PROXY]`),
                    reasoning: `${d.reasoning} · Trade diverted from ${ticker} to ${proxyTicker} due to active 30-day wash-sale lockout.`
                };
            }
        }
        return d;
    });
}

/**
 * Records a new wash sale lockout.
 * Should be called whenever a SELL at a loss is executed in a Taxable account.
 */
export function recordWashSaleLockout(ticker: string) {
    db.prepare(`
        INSERT OR REPLACE INTO wash_sale_lockouts (ticker, locked_until)
        VALUES (?, datetime('now', '+31 days'))
    `).run(ticker);
}
