import db from '@/lib/db/client';

import { ParseSummary } from './csvParser';

/**
 * Parses Futures monthly statement PDF text.
 * Handles three sections:
 * 1. Monthly Trade Confirmations (Individual Fills)
 * 2. Trade Confirmation Summary (Commissions and Fees)
 * 3. Journal Entries (Deposits and Withdrawals)
 */
export async function parseFuturesStatement(pdfText: string, sourceFileName: string): Promise<ParseSummary> {
    const lines = pdfText.split('\n').map(l => l.trim());
    let currentSection: 'NONE' | 'FILLS' | 'SUMMARY' | 'JOURNAL' = 'NONE';
    const summary: ParseSummary = { ingested: 0, duplicates: 0, skipped: 0, totalRows: 0 };

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
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const upper = line.toUpperCase();
            if (upper.includes('TRADE CONFIRMATIONS')) { currentSection = 'FILLS'; continue; }
            if (upper.includes('TRADE CONFIRMATION SUMMARY')) { currentSection = 'SUMMARY'; continue; }
            if (upper.includes('JOURNAL ENTRIES')) { currentSection = 'JOURNAL'; continue; }
            if (upper.includes('OPEN POSITIONS')) { currentSection = 'NONE'; continue; }

            if (currentSection === 'FILLS') {
                const fillRegex = /^(\d{4}-\d{2}-\d{2})\s+([A-Z]{2})\s+([\d,.]+)\s+([\d,.]+)\s+([A-Z]*\s+)?([A-Z/0-9]+)\s+(\d{4})\s+(\d{1,2})\s+\w+\s+[\d-]+\s+([\d,.]+)/;
                const match = line.match(fillRegex);
                if (match) {
                    summary.totalRows++;
                    const tradeDate = match[1];
                    const qtyLong = parseFloat(match[3].replace(/,/g, ''));
                    const qtyShort = parseFloat(match[4].replace(/,/g, ''));
                    const symbol = match[6];
                    const contractYear = match[7];
                    const contractMonthRaw = match[8];
                    const tradePrice = parseFloat(match[9].replace(/,/g, ''));
                    const contractMonth = `${contractYear}-${contractMonthRaw.padStart(2, '0')}`;
                    
                    const key = `${tradeDate}|${symbol}|${contractMonth}|${tradePrice}|${qtyLong}|${qtyShort}`;

                    if (!multiplierCache[symbol]) {
                        const spec = db.prepare('SELECT multiplier FROM alpha_futures_specs WHERE symbol = ?').get(symbol) as any;
                        multiplierCache[symbol] = spec ? spec.multiplier : 1.0;
                    }

                    const existing = db.prepare(`SELECT 1 FROM alpha_futures_fills WHERE trade_date=? AND symbol=? AND contract_month=? AND trade_price=? AND qty_long=? AND qty_short=?`).get(tradeDate, symbol, contractMonth, tradePrice, qtyLong, qtyShort);

                    insertFill.run(sourceFileName, tradeDate, symbol, contractMonth, qtyLong, qtyShort, tradePrice, multiplierCache[symbol]);
                    
                    if (!existing && !processedKeys.has(key)) {
                        summary.ingested++;
                        processedKeys.add(key);
                    } else if (existing) {
                        summary.duplicates++;
                    }
                }
            } else if (currentSection === 'SUMMARY') {
                if (line.includes('USD')) {
                    let tradeDate = null;
                    for (let j = i; j >= Math.max(0, i - 5); j--) {
                        const dateMatch = lines[j].match(/(\d{4}-\d{2}-\d{2})/);
                        if (dateMatch) { tradeDate = dateMatch[1]; break; }
                        const part1 = lines[j].match(/^(\d{4}-)$/);
                        const part2 = lines[j+1]?.match(/^(\d{2}-\d{2})/);
                        if (part1 && part2) { tradeDate = part1[1] + part2[1]; break; }
                    }

                    if (tradeDate) {
                        const numbers = line.match(/-?\d+\.\d+/g);
                        if (numbers && numbers.length >= 4) {
                            const n = numbers.length;
                            const comm = Math.abs(parseFloat(numbers[n-4]));
                            const exch = Math.abs(parseFloat(numbers[n-3]));
                            const nfa  = Math.abs(parseFloat(numbers[n-2]));
                            
                            const symbolMatch = line.match(/([A-Z]{2,5})\s+([A-Z]{2,5})?/);
                            const symbol = symbolMatch ? symbolMatch[1] : null;

                            if (symbol) {
                                rowsToProcess.push({ tradeDate, symbol, comm, exch, nfa });
                            }
                        }
                    }
                }
            } else if (currentSection === 'JOURNAL') {
                const journalRegex = /^(\d{4}-\d{2}-\d{2})\s+\S+\s+(Deposit|Withdrawal|Trade Adjustment)\s+\w+\s+(-?[\d,.]+)/;
                const match = line.match(journalRegex);
                if (match) {
                    insertJournal.run(match[1], match[2], parseFloat(match[3].replace(/,/g, '')), sourceFileName);
                }
            }
        }

        for (const row of rowsToProcess) {
            const totalQtyRow = db.prepare("SELECT SUM(qty_long + qty_short) as q FROM alpha_futures_fills WHERE trade_date = ? AND symbol = ?").get(row.tradeDate, row.symbol) as any;
            const q = totalQtyRow?.q || 1;
            updateCosts.run(row.comm/q, row.exch/q, row.nfa/q, row.tradeDate, row.symbol);
        }
    })();

    return summary;
}
