
import db from '@/lib/db/client';

interface Transaction {
    id: number;
    activity_date: string;
    instrument: string;
    description: string;
    trans_code: string;
    quantity: number;
    price: number;
    amount: number;
}

interface OpenPosition {
    activity_date: string;
    price: number;
    qty: number;
}

export async function reconstructEquityTrades(): Promise<number> {
    console.log('[Reconstruct:EQUITY] Starting reconstruction...');
    db.prepare('DELETE FROM alpha_equity_trades').run();

    const allEquityTrans = db.prepare(`
        SELECT * FROM alpha_transactions 
        WHERE book = 'EQUITY'
        ORDER BY activity_date ASC, id ASC
    `).all() as Transaction[];

    console.log(`[Reconstruct:EQUITY] Fetched ${allEquityTrans.length} transactions.`);

    const groups: Record<string, Transaction[]> = {};
    for (const tx of allEquityTrans) {
        if (!tx.instrument) continue;
        if (!groups[tx.instrument]) groups[tx.instrument] = [];
        groups[tx.instrument].push(tx);
    }

    let totalTrades = 0;

    for (const instrument in groups) {
        const txs = groups[instrument];
        const longStack: OpenPosition[] = [];
        const shortStack: OpenPosition[] = [];

        for (const tx of txs) {
            let qty = Math.abs(tx.quantity);
            if (qty === 0) continue;

            // In our DB: amount < 0 is usually a BUY (debit), amount > 0 is a SELL (credit)
            // But trans_code is the source of truth
            const code = tx.trans_code.toLowerCase();
            const isBuy = code === 'buy' || code === 'bto' || (code === 'ach' && tx.quantity > 0);
            const isSell = code === 'sell' || code === 'stc' || code === 'cdiv' || code === 'mdiv';

            console.log(`[Reconstruct:EQUITY] Processing ${tx.instrument} | ${code} | Qty: ${qty} | isBuy: ${isBuy} | isSell: ${isSell}`);

            if (isBuy) {
                while (qty > 0 && shortStack.length > 0) {
                    const oldestShort = shortStack[0];
                    const matchQty = Math.min(qty, oldestShort.qty);
                    
                    recordEquityTrade(instrument, oldestShort.activity_date, oldestShort.price, tx.activity_date, tx.price, matchQty, 'SHORT');
                    totalTrades++;

                    qty -= matchQty;
                    oldestShort.qty -= matchQty;
                    if (oldestShort.qty <= 0) shortStack.shift();
                }
                if (qty > 0) {
                    longStack.push({ activity_date: tx.activity_date, price: tx.price, qty: qty });
                }
            } else if (isSell) {
                // Divs are effectively sells of 0-cost basis or just cash, but FIFO needs to match them if they have quantity
                // Most divs in RH don't have quantity, they are handled by DailyPnl directly.
                if (code === 'cdiv' || code === 'mdiv') continue; 

                while (qty > 0 && longStack.length > 0) {
                    const oldestLong = longStack[0];
                    const matchQty = Math.min(qty, oldestLong.qty);
                    
                    recordEquityTrade(instrument, oldestLong.activity_date, oldestLong.price, tx.activity_date, tx.price, matchQty, 'LONG');
                    totalTrades++;

                    qty -= matchQty;
                    oldestLong.qty -= matchQty;
                    if (oldestLong.qty <= 0) longStack.shift();
                }
                if (qty > 0) {
                    shortStack.push({ activity_date: tx.activity_date, price: tx.price, qty: qty });
                }
            }
        }
    }

    console.log(`[Reconstruct:EQUITY] Finished. Recorded ${totalTrades} trades.`);
    return totalTrades;
}

function recordEquityTrade(
    instrument: string,
    open_date: string,
    open_price: number,
    close_date: string,
    close_price: number,
    qty: number,
    direction: 'LONG' | 'SHORT'
) {
    let net_pnl: number;
    if (direction === 'LONG') {
        net_pnl = (close_price - open_price) * qty;
    } else {
        net_pnl = (open_price - close_price) * qty;
    }

    const hold_days_raw = Math.floor((new Date(close_date).getTime() - new Date(open_date).getTime()) / (1000 * 60 * 60 * 24));
    const hold_days = isNaN(hold_days_raw) ? 0 : hold_days_raw;

    db.prepare(`
        INSERT INTO alpha_equity_trades (
            instrument, open_date, open_price, close_date, close_price, qty, net_pnl, hold_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(instrument, open_date, open_price || 0, close_date, close_price || 0, qty, net_pnl || 0, hold_days);
}
