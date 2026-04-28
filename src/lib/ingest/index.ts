
import db from '../db/client';

export interface IngestedHolding {
    ticker: string;
    quantity: number;
    costBasis?: number;
    assetType: 'EQUITY' | '1256' | 'OPTION';
    marketValue?: number;
}

/**
 * CORE INGESTION: Append-only Snapshot.
 * Inserts holdings into holdings_ledger rather than overwriting.
 */
export function ingestHoldings(
    accountId: string, 
    holdings: IngestedHolding[],
    snapshotDate?: string // YYYY-MM-DD
) {
    const date = snapshotDate || new Date().toISOString().split('T')[0];

    const insert = db.prepare(`
        INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, cost_basis, asset_type, market_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
        // We DELETE only for the SAME account on the SAME date to allow re-runs
        db.prepare("DELETE FROM holdings_ledger WHERE account_id = ? AND snapshot_date = ?").run(accountId, date);
        
        for (const h of holdings) {
            insert.run(
                date,
                accountId,
                h.ticker,
                h.quantity,
                h.costBasis ?? null,
                h.assetType,
                h.marketValue ?? null
            );
        }
    })();

    return holdings.length;
}
