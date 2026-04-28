import db from '@/lib/db/client';

/**
 * Reconstructs a hypothetical VTI portfolio based on Alpha deposits/withdrawals.
 * @param todayOverride Optional override for the end date (defaults to actual today)
 */
export async function reconstructShadowVti(todayOverride?: string) {
    const today = todayOverride || new Date().toISOString().split('T')[0];

    // 1. Fetch transactions
    const transactions = db.prepare(`
        SELECT activity_date, amount, book 
        FROM alpha_transactions 
        WHERE book IN ('DEPOSIT', 'WITHDRAWAL') 
        ORDER BY activity_date ASC
    `).all() as { activity_date: string, amount: number, book: string }[];

    if (transactions.length === 0) {
        console.log('[ShadowVti] No transactions found. Skipping reconstruction.');
        return;
    }

    // 2. Fetch VTI price history
    const vtiPrices = db.prepare(`
        SELECT date, close 
        FROM price_history 
        WHERE ticker = 'VTI' 
        ORDER BY date ASC
    `).all() as { date: string, close: number }[];

    const priceMap = new Map<string, number>();
    vtiPrices.forEach(p => priceMap.set(p.date, p.close));

    // 3. Determine date range
    const startDate = transactions[0].activity_date;
    
    // 4. Initialize lastKnownPrice from the latest price before or on startDate
    const initialPriceRow = db.prepare(`
        SELECT close FROM price_history 
        WHERE ticker = 'VTI' AND date <= ? 
        ORDER BY date DESC LIMIT 1
    `).get(startDate) as { close: number } | undefined;
    
    let lastKnownPrice = initialPriceRow ? initialPriceRow.close : 0;

    // 5. Group transactions by date
    const transMap = new Map<string, number>();
    transactions.forEach(t => {
        const current = transMap.get(t.activity_date) || 0;
        transMap.set(t.activity_date, current + t.amount);
    });

    // 5. Iterate day by day
    let currentShares = 0;
    let cumulativeDeposits = 0;

    const results: { date: string, shares: number, price: number, value: number, cumulative_deposits: number }[] = [];

    const date = new Date(startDate);
    const endDate = new Date(today);

    while (date <= endDate) {
        const dateStr = date.toISOString().split('T')[0];
        
        // Update price
        if (priceMap.has(dateStr)) {
            lastKnownPrice = priceMap.get(dateStr)!;
        }

        // Handle transactions on this date
        if (transMap.has(dateStr)) {
            const amount = transMap.get(dateStr)!;
            if (lastKnownPrice > 0) {
                const sharesToBuy = amount / lastKnownPrice;
                currentShares += sharesToBuy;
                cumulativeDeposits += amount;
            }
        }

        results.push({
            date: dateStr,
            shares: currentShares,
            price: lastKnownPrice,
            value: currentShares * lastKnownPrice,
            cumulative_deposits: cumulativeDeposits
        });

        date.setDate(date.getDate() + 1);
    }

    // 6. Save results
    db.transaction(() => {
        db.prepare('DELETE FROM alpha_shadow_vti').run();
        const insert = db.prepare(`
            INSERT INTO alpha_shadow_vti (date, shares, price, value, cumulative_deposits)
            VALUES (?, ?, ?, ?, ?)
        `);
        for (const res of results) {
            insert.run(res.date, res.shares, res.price, res.value, res.cumulative_deposits);
        }
    })();

    console.log(`[ShadowVti] Reconstructed ${results.length} days of VTI history.`);
}

export async function getShadowVtiSeries(): Promise<{ date: string, value: number }[]> {
    const rows = db.prepare(`
        SELECT date, value
        FROM alpha_shadow_vti
        ORDER BY date ASC
    `).all() as { date: string, value: number }[];
    return rows;
}
