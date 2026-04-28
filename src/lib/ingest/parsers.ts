// src/lib/ingest/parsers.ts
import { z } from 'zod';

/**
 * Robust CSV parser that handles multiline quoted fields correctly.
 */
export function parseCsvRows(csvContent: string): string[][] {
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

const HoldingSchema = z.object({
    ticker: z.string(),
    quantity: z.number(),
    description: z.string().optional(),
    costBasis: z.number().optional(),
    marketValue: z.number().optional(),
    assetType: z.enum(['EQUITY', '1256', 'OPTION']).default('EQUITY'),
    accountId: z.string().optional(),
    accountName: z.string().optional(),
});

export type Holding = z.infer<typeof HoldingSchema>;

export interface SkippedRow { line: string; reason: string; }
export interface ParseResult {
    holdings: Holding[];
    skipped: SkippedRow[];
    unmapped: Array<{ ticker: string; description: string }>;
    detectedAccounts: Array<{ id: string; name: string }>;
    accountTotals: Record<string, number>;
}

const cleanNum = (str: string | undefined | null) => {
    if (!str || str === '--' || str === '') return 0;
    return parseFloat(str.replace(/[$,%+]/g, '')) || 0;
};

const is1256Contract = (ticker: string): boolean => {
    if (!ticker) return false;
    const patterns = [/^\/[A-Z]+/, /^SPX/, /^NDX/, /^RUT/, /^VIX/];
    return patterns.some(p => p.test(ticker));
};

export function parseGenericHoldings(csvContent: string): ParseResult {
    console.log('[Parser] Starting systematic forensic parse.');
    const allRows = parseCsvRows(csvContent);
    const result: ParseResult = { 
        holdings: [], 
        skipped: [], 
        unmapped: [], 
        detectedAccounts: [],
        accountTotals: {}
    };

    if (allRows.length < 1) return result;

    // 1. Locate Header Row (Fidelity may have metadata at top)
    const headerRowIdx = allRows.findIndex(row => 
        row.some(cell => {
            const c = cell.toLowerCase();
            return c.includes('symbol') || c.includes('account number');
        })
    );

    if (headerRowIdx === -1) {
        throw new Error('CSV missing required header row (Symbol or Account Number).');
    }

    const rawHeader = allRows[headerRowIdx];
    const header = rawHeader.map(h => h.toLowerCase().replace(/^"|"$/g, '').trim());
    
    // 2. Map Column Indices
    const tickerIdx   = header.findIndex(h => h === 'symbol' || h === 'ticker');
    const quantityIdx = header.findIndex(h => h === 'quantity');
    const accNumIdx   = header.findIndex(h => h === 'account number' || h === 'accountnumber');
    const accNameIdx  = header.findIndex(h => h === 'account name' || h === 'accountname');
    const descIdx     = header.findIndex(h => h === 'description' || h === 'name');
    const valueIdx    = header.findIndex(h => h === 'current value' || h === 'market value' || h === 'value');
    const costIdx     = header.findIndex(h => h === 'cost basis total' || h === 'cost basis');

    const FOOTER_PATTERNS = [
        'the data and information', 'brokerage services', 'date downloaded',
        'fidelity brokerage', 'investments are not fdic', 'total account',
    ];

    const unmappedMap: Record<string, string> = {};
    const accountMap = new Map<string, string>();

    // 3. Process Data Rows
    for (let i = headerRowIdx + 1; i < allRows.length; i++) {
        const row = allRows[i];
        if (!row || row.length < 2) continue;

        const line = row.join(',');
        const rawTicker = tickerIdx > -1 ? row[tickerIdx]?.trim().replace(/^"|"$/g, '') : '';
        const description = descIdx > -1 ? row[descIdx]?.trim().replace(/^"|"$/g, '') : '';
        
        if (rawTicker && FOOTER_PATTERNS.some(p => rawTicker.toLowerCase().includes(p))) continue;
        if (description && FOOTER_PATTERNS.some(p => description.toLowerCase().includes(p))) continue;

        let ticker = rawTicker;

        // Fidelity Vanguard Trust Heuristics (Restore dcdc32c3)
        if (!ticker && description) {
            if (description.includes('Instl 500 Index Trust')) ticker = 'VIIIX';
            else if (description.includes('Target Retire 2045 Tr')) ticker = 'VTIVX';
            else if (description.includes('Instl Ext Market Idx Tr')) ticker = 'VIEIX';
            else if (description.includes('Instl Ttl Intl Stk Mkt Tr')) ticker = 'VTSNX';
            else if (description.includes('Instl Ttl Bd Mkt Idx Tr')) ticker = 'VBMPX';
        }

        if (!ticker || ticker.toLowerCase() === 'symbol') {
            if (row.length > 5) result.skipped.push({ line, reason: 'EMPTY_TICKER' });
            continue;
        }

        const accId = accNumIdx > -1 ? row[accNumIdx]?.trim().replace(/^"|"$/g, '') : 'DEFAULT';
        const accName = accNameIdx > -1 ? row[accNameIdx]?.trim().replace(/^"|"$/g, '') : 'Default Account';
        
        if (accId) accountMap.set(accId, accName);

        const marketValue = valueIdx > -1 ? cleanNum(row[valueIdx]) : 0;
        
        // Track totals for fail-safe verification
        if (accId) {
            result.accountTotals[accId] = (result.accountTotals[accId] || 0) + marketValue;
        }

        // 4. Handle "Core" Sweep Assets (The dcdc32c3 fix)
        const isCash = ticker.includes('**') || ticker === 'CASH' || ticker === 'CORE' || ticker === 'SPAXX' || ticker === 'FDRXX';
        
        if (isCash) {
            if (marketValue === 0) continue;
            result.holdings.push({
                ticker: 'CASH',
                quantity: marketValue,
                costBasis: marketValue,
                marketValue: marketValue,
                assetType: 'EQUITY',
                accountId: accId,
                accountName: accName,
                description: description || ticker
            });
            continue;
        }

        // 5. Standard Assets
        const quantity = quantityIdx > -1 ? cleanNum(row[quantityIdx]) : 0;
        const costBasis = costIdx > -1 ? cleanNum(row[costIdx]) : undefined;

        if (quantity === 0 && (!marketValue || marketValue === 0)) continue;

        const finalTicker = ticker.toUpperCase();
        result.holdings.push({
            ticker: finalTicker,
            quantity,
            costBasis,
            marketValue: marketValue || undefined,
            assetType: is1256Contract(finalTicker) ? '1256' : (description?.includes('OPT') ? 'OPTION' : 'EQUITY'),
            accountId: accId,
            accountName: accName,
            description: description || ticker
        });
        
        if (description) unmappedMap[finalTicker] = description;
    }

    result.detectedAccounts = Array.from(accountMap.entries()).map(([id, name]) => ({ id, name }));
    result.unmapped = Object.entries(unmappedMap).map(([ticker, description]) => ({ ticker, description }));

    console.log(`[Parser] Finished. Ingested: ${result.holdings.length}, Skipped: ${result.skipped.length}`);
    return result;
}
