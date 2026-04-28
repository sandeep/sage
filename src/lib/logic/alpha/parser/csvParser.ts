
import db from '@/lib/db/client';

/**
 * Trans code to book classification mapping as per spec:
 * FUTSWP -> FUTURES_CASH
 * STO, BTC, BTO, STC, OEXP, OASGN, OEXCS -> OPTION
 * Buy, Sell -> EQUITY
 * ACH, ACSDIV -> DEPOSIT
 * GOLD, MINT, GMPC -> FEE
 * INT, GDBP -> INCOME
 */
const TRANS_CODE_TO_BOOK: Record<string, string> = {
    'FUTSWP': 'FUTURES_CASH',
    'STO': 'OPTION',
    'BTC': 'OPTION',
    'BTO': 'OPTION',
    'STC': 'OPTION',
    'OEXP': 'OPTION',
    'OASGN': 'OPTION',
    'OEXCS': 'OPTION',
    'Buy': 'EQUITY',
    'Sell': 'EQUITY',
    'ACH': 'DEPOSIT',
    'ACSDIV': 'DEPOSIT',
    'GOLD': 'FEE',
    'MINT': 'FEE',
    'GMPC': 'FEE',
    'INT': 'INCOME',
    'GDBP': 'INCOME',
};

export interface ParseSummary {
    totalRows: number;
    ingested: number;
    duplicates: number;
    skipped: number;
}

function cleanAmount(val: string): number {
    if (!val) return 0;
    // Robinhood uses ($1,234.56) for negative amounts
    let clean = val.replace(/[$,]/g, '').trim();
    let isNegative = false;
    if (clean.includes('(') || clean.includes(')')) {
        isNegative = true;
        clean = clean.replace(/[()]/g, '');
    } else if (clean.startsWith('-')) {
        isNegative = true;
        clean = clean.substring(1);
    }
    const num = parseFloat(clean) || 0;
    return isNegative ? -num : num;
}

/**
 * Robust CSV parser that handles multiline quoted fields correctly.
 */
function parseCsvRows(csvContent: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < csvContent.length; i++) {
        const char = csvContent[i];
        const nextChar = csvContent[i + 1];

        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    // Escaped quote
                    currentCell += '"';
                    i++;
                } else {
                    // Closing quote
                    inQuotes = false;
                }
            } else {
                currentCell += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentRow.push(currentCell.trim());
                currentCell = '';
            } else if (char === '\n' || char === '\r') {
                if (char === '\r' && nextChar === '\n') i++;
                currentRow.push(currentCell.trim());
                if (currentRow.some(cell => cell !== '')) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentCell = '';
            } else {
                currentCell += char;
            }
        }
    }

    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell !== '')) {
            rows.push(currentRow);
        }
    }

    return rows;
}

/**
 * Parses transaction CSV content and inserts into alpha_transactions table.
 */
export async function parseTransactionCsv(csvContent: string, sourceFileName: string): Promise<ParseSummary> {
    const allRows = parseCsvRows(csvContent);
    const summary: ParseSummary = { totalRows: allRows.length, ingested: 0, duplicates: 0, skipped: 0 };

    if (allRows.length < 1) return summary;

    // 1. Locate Header Row (RESILIENCE: Don't assume index 0)
    const headerRowIdx = allRows.findIndex(row => row.includes('Activity Date'));
    if (headerRowIdx === -1) {
        console.error('[Alpha CSV] Header mismatch. Row sample:', allRows[0]);
        throw new Error('CSV missing required "Activity Date" column.');
    }

    const header = allRows[headerRowIdx].map(h => h.replace(/^"|"$/g, '').trim());
    const colIdx = {
        activityDate: header.indexOf('Activity Date'),
        instrument: header.indexOf('Instrument'),
        description: header.indexOf('Description'),
        transCode: header.indexOf('Trans Code'),
        quantity: header.indexOf('Quantity'),
        price: header.indexOf('Price'),
        amount: header.indexOf('Amount'),
    };

    const checkStmt = db.prepare(`
        SELECT 1 FROM alpha_transactions 
        WHERE activity_date = ? 
          AND (instrument = ? OR (instrument IS NULL AND ? IS NULL))
          AND trans_code = ? 
          AND (quantity = ? OR (quantity IS NULL AND ? IS NULL))
          AND amount = ?
    `);

    const insertStmt = db.prepare(`
        INSERT INTO alpha_transactions (
            source_file, activity_date, instrument, description, trans_code, quantity, price, amount, book
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
        for (let i = headerRowIdx + 1; i < allRows.length; i++) {
            const parts = allRows[i];
            
            // 2. Row Integrity Check
            const rawDate = parts[colIdx.activityDate];
            if (!rawDate) {
                summary.skipped++;
                continue;
            }

            // 3. Flexible Date Engine (Handles M/D/YYYY)
            const dateObj = new Date(rawDate);
            if (isNaN(dateObj.getTime())) {
                if (rawDate.length > 50) {
                    console.log(`[Alpha CSV] Row ${i}: Skipping metadata slop.`);
                } else {
                    console.log(`[Alpha CSV] Row ${i}: Skipping - Invalid Date: "${rawDate}"`);
                }
                summary.skipped++;
                continue;
            }
            const activityDate = dateObj.toISOString().split('T')[0];

            // 4. Robust Trans Code Check
            const rawTransCode = parts[colIdx.transCode];
            if (!rawTransCode) {
                console.log(`[Alpha CSV] Row ${i}: Skipping - Missing Trans Code.`);
                summary.skipped++;
                continue;
            }

            // Case-insensitive mapping
            const transCodeKey = Object.keys(TRANS_CODE_TO_BOOK).find(
                k => k.toLowerCase() === rawTransCode.toLowerCase()
            ) || rawTransCode;
            
            const instrument = parts[colIdx.instrument] || null;
            const description = parts[colIdx.description] || null;
            
            // 5. Quantity Normalization (Handles "1S", etc.)
            const rawQty = parts[colIdx.quantity] || '';
            const quantity = rawQty ? parseFloat(rawQty.replace(/[^\d.]/g, '')) : null;
            
            const price = parts[colIdx.price] ? parseFloat(parts[colIdx.price].replace(/[$,]/g, '')) : null;
            const amount = cleanAmount(parts[colIdx.amount]);
            const book = TRANS_CODE_TO_BOOK[transCodeKey] || 'EQUITY';

            // 6. Deduplication check
            const alreadyExists = checkStmt.get(
                activityDate, 
                instrument, instrument, 
                rawTransCode, 
                quantity, quantity, 
                amount
            );

            if (!alreadyExists) {
                insertStmt.run(
                    sourceFileName,
                    activityDate,
                    instrument,
                    description,
                    rawTransCode,
                    quantity,
                    price,
                    amount,
                    book
                );
                summary.ingested++;
            } else {
                summary.duplicates++;
            }
        }
    })();

    console.log(`[Alpha CSV] Ingestion Complete: ${summary.ingested} Ingested, ${summary.duplicates} Duplicates, ${summary.skipped} Skipped.`);
    return summary;
}
