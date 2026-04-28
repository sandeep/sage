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
}

interface OpenPosition {
    trade_date: string;
    price: number;
    qty: number;
    multiplier: number;
}

export async function reconstructFuturesTrades(): Promise<number> {
    // Clear existing trades to avoid duplicates on re-run
    db.prepare('DELETE FROM alpha_futures_trades').run();

    const allFills = db.prepare(`
        SELECT * FROM alpha_futures_fills 
        ORDER BY trade_date ASC, id ASC
    `).all() as Fill[];

    console.log(`[Reconstruct:FUTURES] Fetched ${allFills.length} fills for book.`);

    // Group fills by symbol and contract_month
    const groups: Record<string, Fill[]> = {};
    for (const fill of allFills) {
        const symbol = fill.symbol || 'UNKNOWN';
        const key = `${symbol}|${fill.contract_month}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(fill);
    }

    let totalTrades = 0;

    for (const key in groups) {
        const fills = groups[key];
        const [symbol, contractMonth] = key.split('|');
        
        const longStack: OpenPosition[] = [];
        const shortStack: OpenPosition[] = [];

        for (const fill of fills) {
            let qtyLong = Math.abs(fill.qty_long);
            let qtyShort = Math.abs(fill.qty_short);

            // Process LONG fills
            while (qtyLong > 0) {
                if (shortStack.length > 0) {
                    // Match against existing SHORT positions
                    const oldestShort = shortStack[0];
                    const matchQty = Math.min(qtyLong, oldestShort.qty);
                    
                    recordTrade(
                        symbol,
                        contractMonth,
                        'SHORT',
                        oldestShort.trade_date,
                        oldestShort.price,
                        fill.trade_date,
                        fill.trade_price,
                        matchQty,
                        fill.multiplier
                    );
                    totalTrades++;

                    qtyLong -= matchQty;
                    oldestShort.qty -= matchQty;
                    if (oldestShort.qty === 0) shortStack.shift();
                } else {
                    // No SHORT positions to match, add to LONG stack
                    longStack.push({
                        trade_date: fill.trade_date,
                        price: fill.trade_price,
                        qty: qtyLong,
                        multiplier: fill.multiplier
                    });
                    qtyLong = 0;
                }
            }

            // Process SHORT fills
            while (qtyShort > 0) {
                if (longStack.length > 0) {
                    // Match against existing LONG positions
                    const oldestLong = longStack[0];
                    const matchQty = Math.min(qtyShort, oldestLong.qty);
                    
                    recordTrade(
                        symbol,
                        contractMonth,
                        'LONG',
                        oldestLong.trade_date,
                        oldestLong.price,
                        fill.trade_date,
                        fill.trade_price,
                        matchQty,
                        fill.multiplier
                    );
                    totalTrades++;

                    qtyShort -= matchQty;
                    oldestLong.qty -= matchQty;
                    if (oldestLong.qty === 0) longStack.shift();
                } else {
                    // No LONG positions to match, add to SHORT stack
                    shortStack.push({
                        trade_date: fill.trade_date,
                        price: fill.trade_price,
                        qty: qtyShort,
                        multiplier: fill.multiplier
                    });
                    qtyShort = 0;
                }
            }
        }
    }

    console.log(`[Reconstruct:FUTURES] Reconstruction complete. Total trades recorded: ${totalTrades}`);
    return totalTrades;
}

function recordTrade(
    symbol: string,
    contract_month: string,
    direction: 'LONG' | 'SHORT',
    open_date: string,
    open_price: number,
    close_date: string,
    close_price: number,
    qty: number,
    multiplier: number
) {
    let net_pnl: number;
    if (direction === 'LONG') {
        net_pnl = (close_price - open_price) * qty * multiplier;
    } else {
        net_pnl = (open_price - close_price) * qty * multiplier;
    }

    // NaN Protection
    if (isNaN(net_pnl)) net_pnl = 0;

    const hold_days_raw = Math.floor(
        (new Date(close_date).getTime() - new Date(open_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    let hold_days = isNaN(hold_days_raw) ? 0 : hold_days_raw;
    if (isNaN(hold_days)) hold_days = 0;

    console.log(`[Reconstruct:FUTURES] Trade: ${symbol} ${contract_month} | Open: ${open_date} | Close: ${close_date} | P&L: ${net_pnl.toFixed(2)}`);

    db.prepare(`
        INSERT INTO alpha_futures_trades (
            symbol, contract_month, direction, open_date, open_price, 
            close_date, close_price, qty, net_pnl, hold_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        symbol || 'UNKNOWN',
        contract_month,
        direction,
        open_date,
        open_price,
        close_date,
        close_price,
        qty,
        net_pnl,
        hold_days
    );
}
