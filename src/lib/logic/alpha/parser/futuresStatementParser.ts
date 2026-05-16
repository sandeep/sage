
import db from '@/lib/db/client';

/**
 * Parses Futures monthly statement PDF text.
 * Handles three sections:
 * 1. Monthly Trade Confirmations (Individual Fills)
 * 2. Trade Confirmation Summary (Commissions and Fees)
 * 3. Journal Entries (Deposits and Withdrawals)
 */
export async function parseFuturesStatement(pdfText: string, sourceFileName: string): Promise<number> {
    const lines = pdfText.split('\n').map(l => l.trim());
    let currentSection: 'NONE' | 'FILLS' | 'SUMMARY' | 'JOURNAL' = 'NONE';
    let recordsParsed = 0;

    const insertFill = db.prepare(`
        INSERT INTO alpha_futures_fills (
            source_file, trade_date, symbol, contract_month, qty_long, qty_short, trade_price, multiplier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(trade_date, symbol, contract_month, trade_price, qty_long, qty_short) DO UPDATE SET
            source_file = excluded.source_file
    `);

    const updateCosts = db.prepare(`
        UPDATE alpha_futures_fills
        SET commission = ? * (qty_long + qty_short), 
            exchange_fees = ? * (qty_long + qty_short), 
            nfa_fees = ? * (qty_long + qty_short)
        WHERE trade_date = ? AND symbol = ?
    `);

    const insertJournal = db.prepare(`
        INSERT OR IGNORE INTO alpha_futures_journal (trade_date, description, amount, source_file)
        VALUES (?, ?, ?, ?)
    `);

    const multiplierCache: Record<string, number> = {};
    const rowsToProcess: Array<{ tradeDate: string, symbol: string, comm: number, exch: number, nfa: number }> = [];
    const processedKeys = new Set<string>();

    db.transaction(() => {
        for (const line of lines) {
            const upper = line.toUpperCase();
            if (upper.includes('TRADE CONFIRMATIONS')) { currentSection = 'FILLS'; continue; }
            if (upper.includes('TRADE CONFIRMATION SUMMARY')) { currentSection = 'SUMMARY'; continue; }
            if (upper.includes('JOURNAL ENTRIES')) { currentSection = 'JOURNAL'; continue; }
            if (upper.includes('OPEN POSITIONS')) { currentSection = 'NONE'; continue; }

            if (currentSection === 'FILLS') {
                const fillRegex = /^(\d{4}-\d{2}-\d{2})\s+([A-Z]+)\s+([\d,.]+)\s+([\d,.]+)\s+(?:[A-Z]+\s+)?(\w+)\s+(\d{4})\s+(\d{1,2})\s+\w+\s+[\d-]+\s+([\d,.]+)/;
                const match = line.match(fillRegex);
                if (match) {
                    const tradeDate = match[1];
                    const qtyLong = parseFloat(match[3].replace(/,/g, ''));
                    const qtyShort = parseFloat(match[4].replace(/,/g, ''));
                    const symbol = match[5];
                    const contractYear = match[6];
                    const contractMonthRaw = match[7];
                    const tradePrice = parseFloat(match[8].replace(/,/g, ''));
                    const contractMonth = `${contractYear}-${contractMonthRaw.padStart(2, '0')}`;
                    
                    const key = `${tradeDate}|${symbol}|${contractMonth}|${tradePrice}|${qtyLong}|${qtyShort}`;

                    if (!multiplierCache[symbol]) {
                        const spec = db.prepare('SELECT multiplier FROM alpha_futures_specs WHERE symbol = ?').get(symbol) as any;
                        multiplierCache[symbol] = spec ? spec.multiplier : 1.0;
                    }

                    const existing = db.prepare(`SELECT 1 FROM alpha_futures_fills WHERE trade_date=? AND symbol=? AND contract_month=? AND trade_price=? AND qty_long=? AND qty_short=?`).get(tradeDate, symbol, contractMonth, tradePrice, qtyLong, qtyShort);

                    insertFill.run(sourceFileName, tradeDate, symbol, contractMonth, qtyLong, qtyShort, tradePrice, multiplierCache[symbol]);
                    
                    if (!existing && !processedKeys.has(key)) {
                        recordsParsed++;
                        processedKeys.add(key);
                    }
                }
            } else if (currentSection === 'SUMMARY') {
                // Regex for Summary table rows
                const summaryRegex = /^(\d{4}-\d{2}-\d{2})\s+([A-Z]+)\s+[\d,.]+\s+[\d,.]+\s+[\d,.]*\s*[\d,.]*\s*(\w+)\s+.*?\s+(-?[\d,.]+)\s+(-?[\d,.]+)\s+(-?[\d,.]+)\s+(-?[\d,.]+)\s+USD/;
                const match = line.match(summaryRegex);
                if (match) {
                    rowsToProcess.push({
                        tradeDate: match[1],
                        symbol: match[3],
                        comm: Math.abs(parseFloat(match[4])),
                        exch: Math.abs(parseFloat(match[5])),
                        nfa: Math.abs(parseFloat(match[6]))
                    });
                }
            } else if (currentSection === 'JOURNAL') {
                const match = line.match(/^(\d{4}-\d{2}-\d{2})\s+\S+\s+(Deposit|Withdrawal|Trade Adjustment)\s+\w+\s+(-?[\d,.]+)/);
                if (match) {
                    const tradeDate = match[1];
                    const desc = match[2];
                    const amount = parseFloat(match[3].replace(/,/g, ''));
                    insertJournal.run(tradeDate, desc, amount, sourceFileName);
                }
            }
        }

        // Pass 2: Distribute summary costs
        for (const row of rowsToProcess) {
            const totalQtyRow = db.prepare("SELECT SUM(qty_long + qty_short) as q FROM alpha_futures_fills WHERE trade_date = ? AND symbol = ?").get(row.tradeDate, row.symbol) as any;
            const q = totalQtyRow?.q || 1;
            updateCosts.run(row.comm/q, row.exch/q, row.nfa/q, row.tradeDate, row.symbol);
        }
    })();

    return recordsParsed;
}
