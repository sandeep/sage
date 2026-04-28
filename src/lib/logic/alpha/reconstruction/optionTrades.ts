
import db from '@/lib/db/client';

interface Transaction {
    id: number;
    activity_date: string;
    instrument: string;
    description: string;
    trans_code: string;
    quantity: string | number; // Can be "1S" or 1
    price: number;
    amount: number;
}

interface OpenOption {
    activity_date: string;
    trans_code: string;
    qty: number;
    premium: number;
}

export async function reconstructOptionTrades(): Promise<number> {
    console.log('[Reconstruct:OPTIONS] Starting reconstruction...');
    db.prepare('DELETE FROM alpha_option_trades').run();

    const allOptionTrans = db.prepare(`
        SELECT * FROM alpha_transactions 
        WHERE book = 'OPTION'
        ORDER BY activity_date ASC, id ASC
    `).all() as Transaction[];

    console.log(`[Reconstruct:OPTIONS] Fetched ${allOptionTrans.length} transactions for book.`);

    const groups: Record<string, Transaction[]> = {};
    for (const tx of allOptionTrans) {
        if (!tx.description) continue;
        // Normalize description: remove newlines, extra spaces, and lowercase
        const key = tx.description.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Extract core option part if it's an expiration/assignment/exercise row
        let normalizedKey = key;
        const prefixes = [
            'optionexpirationfor',
            'optionassignmentfor',
            'optionexercisefor'
        ];
        for (const p of prefixes) {
            if (key.startsWith(p)) {
                normalizedKey = key.replace(p, '');
                break;
            }
        }

        if (!groups[normalizedKey]) groups[normalizedKey] = [];
        groups[normalizedKey].push(tx);
    }

    let totalTrades = 0;

    for (const normalizedKey in groups) {
        const txs = groups[normalizedKey];
        const { option_type, strike, expiry } = parseOptionDescription(normalizedKey);
        
        const openStack: OpenOption[] = [];

        for (const tx of txs) {
            const code = (tx.trans_code || '').toUpperCase();
            // Handle "1S" or "1" strings
            const qtyRaw = String(tx.quantity).replace(/[S]/gi, '');
            const qty = Math.abs(parseFloat(qtyRaw)) || 0;
            const premium = tx.amount || 0;

            if (qty === 0) continue;

            if (code === 'STO' || code === 'BTO') {
                openStack.push({
                    activity_date: tx.activity_date,
                    trans_code: code,
                    qty: qty,
                    premium: premium
                });
            } else {
                // Closing code: BTC, STC, OEXP, OASGN, OEXCS
                let remainingCloseQty = qty;
                
                while (remainingCloseQty > 0 && openStack.length > 0) {
                    const oldestOpen = openStack[0];
                    const matchQty = Math.min(remainingCloseQty, oldestOpen.qty);
                    
                    // Proportionate premium
                    const openPremiumPart = oldestOpen.qty > 0 ? (oldestOpen.premium / oldestOpen.qty) * matchQty : 0;
                    const closePremiumPart = qty > 0 ? (premium / qty) * matchQty : 0;

                    recordOptionTrade({
                        instrument: tx.instrument || 'UNKNOWN',
                        option_key: normalizedKey,
                        option_type,
                        strike,
                        expiry,
                        direction: oldestOpen.trans_code === 'STO' ? 'SHORT' : 'LONG',
                        open_date: oldestOpen.activity_date,
                        open_code: oldestOpen.trans_code,
                        open_qty: matchQty,
                        open_premium: openPremiumPart,
                        close_date: tx.activity_date,
                        close_code: code,
                        close_qty: matchQty,
                        close_premium: closePremiumPart
                    });
                    totalTrades++;

                    remainingCloseQty -= matchQty;
                    oldestOpen.qty -= matchQty;
                    oldestOpen.premium -= openPremiumPart;
                    if (oldestOpen.qty <= 0) openStack.shift();
                }
            }
        }

        // Record any remaining open positions
        for (const remaining of openStack) {
            if (remaining.qty <= 0) continue;
            recordOptionTrade({
                instrument: txs[0]?.instrument || 'UNKNOWN',
                option_key: normalizedKey,
                option_type,
                strike,
                expiry,
                direction: remaining.trans_code === 'STO' ? 'SHORT' : 'LONG',
                open_date: remaining.activity_date,
                open_code: remaining.trans_code,
                open_qty: remaining.qty,
                open_premium: remaining.premium,
                close_date: null,
                close_code: null,
                close_qty: null,
                close_premium: null
            });
        }
    }

    console.log(`[Reconstruct:OPTIONS] Finished. Total trades recorded: ${totalTrades}`);
    return totalTrades;
}

function parseOptionDescription(desc: string) {
    const parts = desc.split(' ');
    let option_type = 'UNKNOWN';
    let strike: number | null = null;
    let expiry: string | null = null;

    if (desc.toUpperCase().includes(' CALL ')) option_type = 'CALL';
    if (desc.toUpperCase().includes(' PUT ')) option_type = 'PUT';

    const strikePart = parts.find(p => p.startsWith('$'));
    if (strikePart) {
        strike = parseFloat(strikePart.replace('$', ''));
    }

    const datePattern = /\d{1,2}\/\d{1,2}\/\d{4}/;
    const match = desc.match(datePattern);
    if (match) {
        expiry = match[0];
    }

    return { option_type, strike, expiry };
}

function recordOptionTrade(data: any) {
    const {
        instrument, option_key, option_type, strike, expiry, direction,
        open_date, open_code, open_qty, open_premium,
        close_date, close_code, close_qty, close_premium
    } = data;

    let net_pnl = 0;
    let outcome = 'OPEN';
    let hold_days = 0;

    if (close_date) {
        net_pnl = (open_premium || 0) + (close_premium || 0);
        const hold_days_raw = Math.floor((new Date(close_date).getTime() - new Date(open_date).getTime()) / (1000 * 60 * 60 * 24));
        hold_days = isNaN(hold_days_raw) ? 0 : hold_days_raw;
        
        if (close_code === 'OEXP') outcome = 'EXPIRED';
        else if (close_code === 'OASGN') outcome = 'ASSIGNED';
        else if (close_code === 'OEXCS') outcome = 'EXERCISED';
        else outcome = 'CLOSED';

        console.log(`[Reconstruct:OPTIONS] Trade: ${instrument} | ${open_date} -> ${close_date} | P&L: $${net_pnl.toFixed(2)}`);
    }

    db.prepare(`
        INSERT INTO alpha_option_trades (
            instrument, option_key, option_type, strike, expiry, direction,
            open_date, open_code, open_qty, open_premium,
            close_date, close_code, close_qty, close_premium,
            net_pnl, outcome, hold_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        instrument || 'UNKNOWN', option_key, option_type, strike, expiry, direction,
        open_date, open_code, open_qty, open_premium || 0,
        close_date, close_code, close_qty, close_premium || 0,
        net_pnl, outcome, hold_days
    );
}
