import db from '@/lib/db/client';

export interface MonthReconciliation {
    month: string;
    csvTotal: number;
    pdfTotal: number;
    delta: number;
    status: 'MATCH' | 'MISMATCH' | 'NO_DATA';
}

/**
 * Validates PDF trade reconstruction against CSV cash reality.
 * Returns a list of monthly reconciliations.
 */
export async function reconcileFutures(): Promise<MonthReconciliation[]> {
    // 1. Get monthly sums from CSV (FUTSWP)
    const csvRows = db.prepare(`
        SELECT 
            strftime('%Y-%m', activity_date) as month,
            SUM(amount) as total
        FROM alpha_transactions
        WHERE trans_code = 'FUTSWP'
        GROUP BY month
        ORDER BY month DESC
    `).all() as { month: string, total: number }[];

    // 2. Get monthly sums from PDF Trades
    const pdfRows = db.prepare(`
        SELECT 
            strftime('%Y-%m', close_date) as month,
            SUM(net_pnl) as total
        FROM alpha_futures_trades
        GROUP BY month
    `).all() as { month: string, total: number }[];

    const pdfMap = new Map(pdfRows.map(r => [r.month, r.total]));

    // 3. Compare
    return csvRows.map(csv => {
        const pdfTotal = pdfMap.get(csv.month) || 0;
        const delta = Math.abs(csv.total - pdfTotal);
        
        return {
            month: csv.month,
            csvTotal: csv.total,
            pdfTotal: pdfTotal,
            delta: csv.total - pdfTotal,
            status: pdfTotal === 0 ? 'NO_DATA' : delta < 1.0 ? 'MATCH' : 'MISMATCH'
        };
    });
}
