
import db from '@/lib/db/client';

/**
 * Parses Futures monthly statement PDF text.
 * Extract data from "Monthly Trade Confirmations" table.
 * Look up multiplier from alpha_futures_specs by symbol.
 * Store in alpha_futures_fills.
 * Returns the number of new records inserted.
 */
export async function parseFuturesStatement(pdfText: string, sourceFileName: string): Promise<number> {
    if (!pdfText.includes('Monthly Trade Confirmations')) {
        return 0;
    }

    const lines = pdfText.split('\n');
    let inTable = false;
    let insertCount = 0;

    // Regex for data row:
    // Trade Date (0) | AT (1) | Qty Long (2) | Qty Short (3) | Subtype (4) | Symbol (5) | Contract Year (6) | Month (7) | ... | Trade Price (10)
    // 2025-02-15 B 1 0 Future MES 2025 3 CME 2025-03-21 5100.25 USD Trade Description
    const rowRegex = /^(\d{4}-\d{2}-\d{2})\s+([BS])\s+(\d+)\s+(\d+)\s+\w+\s+(\w+)\s+(\d{4})\s+(\d{1,2})\s+\w+\s+\d{4}-\d{2}-\d{2}\s+([\d,.]+)/;

    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO alpha_futures_fills (
            source_file, trade_date, symbol, contract_month, qty_long, qty_short, trade_price, multiplier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const multiplierCache: Record<string, number> = {};

    db.transaction(() => {
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.includes('Monthly Trade Confirmations')) {
                inTable = true;
                continue;
            }

            if (!inTable) continue;
            
            // If we hit another major section header, maybe we're done with the table? 
            // For now, let's just try to match rows.
            
            const match = trimmed.match(rowRegex);
            if (match) {
                const tradeDate = match[1];
                const symbol = match[5];
                const contractYear = match[6];
                const contractMonthRaw = match[7];
                const qtyLong = parseFloat(match[3]);
                const qtyShort = parseFloat(match[4]);
                const tradePrice = parseFloat(match[8].replace(/,/g, ''));

                // Format contract month: "2025 3" -> "2025-03"
                const contractMonth = `${contractYear}-${contractMonthRaw.padStart(2, '0')}`;

                // Multiplier lookup
                if (multiplierCache[symbol] === undefined) {
                    const spec = db.prepare('SELECT multiplier FROM alpha_futures_specs WHERE symbol = ?').get(symbol) as any;
                    multiplierCache[symbol] = spec ? spec.multiplier : 1.0; // Default to 1.0 or should we warn?
                    if (!spec) {
                        console.warn(`[FuturesParser] Unknown multiplier for symbol ${symbol}, defaulting to 1.0`);
                    }
                }

                const multiplier = multiplierCache[symbol];

                const result = insertStmt.run(
                    sourceFileName,
                    tradeDate,
                    symbol,
                    contractMonth,
                    qtyLong,
                    qtyShort,
                    tradePrice,
                    multiplier
                );

                if (result.changes > 0) {
                    insertCount++;
                }
            }
        }
    })();

    return insertCount;
}
