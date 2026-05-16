import db from '@/lib/db/client';

interface Fill {
    id: number;
    trade_date: string;
    symbol: string;
    contract_month: string;
    qty_long: number;
    qty_short: number;
    trade_price: number;
    multiplier: number;
    commission: number;
    exchange_fees: number;
    nfa_fees: number;
}

interface OpenPosition {
    trade_date: string;
    price: number;
    qty: number;
    multiplier: number;
    unit_fees: number;
}

export async function reconstructFuturesTrades(): Promise<number> {
    db.prepare('DELETE FROM alpha_futures_trades').run();

    const allFills = db.prepare(`
        SELECT 
            trade_date, symbol, contract_month, 
            SUM(qty_long) as qty_long, 
            SUM(qty_short) as qty_short, 
            trade_price, multiplier,
            SUM(commission) as commission,
            SUM(exchange_fees) as exchange_fees,
            SUM(nfa_fees) as nfa_fees
        FROM alpha_futures_fills 
        GROUP BY trade_date, symbol, contract_month, trade_price, multiplier
        ORDER BY trade_date ASC
    `).all() as Fill[];

    const groups: Record<string, Fill[]> = {};
    for (const fill of allFills) {
        const key = `${fill.symbol}|${fill.contract_month}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(fill);
    }

    let totalTradesCount = 0;

    for (const key in groups) {
        const fills = groups[key];
        const [symbol, contractMonth] = key.split('|');
        
        const longStack: OpenPosition[] = [];
        const shortStack: OpenPosition[] = [];

        for (const fill of fills) {
            let qtyL = fill.qty_long;
            let qtyS = fill.qty_short;
            const totalQ = (qtyL + qtyS) || 1;
            const uFees = (fill.commission + fill.exchange_fees + fill.nfa_fees) / totalQ;

            // MATCHING (FIFO)
            while (qtyL > 0 && shortStack.length > 0) {
                const oldest = shortStack[0];
                const m = Math.min(qtyL, oldest.qty);
                recordTrade(symbol, contractMonth, 'SHORT', oldest.trade_date, oldest.price, fill.trade_date, fill.trade_price, m, fill.multiplier, (oldest.unit_fees * m) + (uFees * m));
                qtyL -= m; oldest.qty -= m; totalTradesCount++;
                if (oldest.qty <= 0) shortStack.shift();
            }
            while (qtyS > 0 && longStack.length > 0) {
                const oldest = longStack[0];
                const m = Math.min(qtyS, oldest.qty);
                recordTrade(symbol, contractMonth, 'LONG', oldest.trade_date, oldest.price, fill.trade_date, fill.trade_price, m, fill.multiplier, (oldest.unit_fees * m) + (uFees * m));
                qtyS -= m; oldest.qty -= m; totalTradesCount++;
                if (oldest.qty <= 0) longStack.shift();
            }

            // STACKING
            if (qtyL > 0) longStack.push({ trade_date: fill.trade_date, price: fill.trade_price, qty: qtyL, multiplier: fill.multiplier, unit_fees: uFees });
            if (qtyS > 0) shortStack.push({ trade_date: fill.trade_date, price: fill.trade_price, qty: qtyS, multiplier: fill.multiplier, unit_fees: uFees });
        }
    }
    return totalTradesCount;
}

function recordTrade(symbol: string, contract_month: string, direction: 'LONG' | 'SHORT', open_date: string, open_price: number, close_date: string, close_price: number, qty: number, multiplier: number, totalFees: number) {
    let gross = (direction === 'LONG') ? (close_price - open_price) * qty * multiplier : (open_price - close_price) * qty * multiplier;
    
    // Calculate hold days
    const start = new Date(open_date);
    const end = new Date(close_date);
    const holdDays = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    db.prepare(`INSERT INTO alpha_futures_trades (symbol, contract_month, direction, open_date, open_price, close_date, close_price, qty, net_pnl, hold_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(symbol, contract_month, direction, open_date, open_price, close_date, close_price, qty, gross - totalFees, holdDays);
}
