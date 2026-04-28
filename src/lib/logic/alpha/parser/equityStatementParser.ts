
import db from '@/lib/db/client';

function cleanAmount(val: string): number {
    if (!val) return 0;
    return parseFloat(val.replace(/[$,]/g, '').trim()) || 0;
}

/**
 * Parses Equity monthly statement PDF text.
 * Extract Opening Balance and Closing Balance from "Account Summary" table.
 * Store in alpha_nav_snapshots.
 * Returns true if successful.
 */
export async function parseEquityStatement(pdfText: string, sourceFileName: string): Promise<boolean> {
    // 1. Extract Month
    // Format: "Period: 2025-02-01 to 2025-02-28" or "Date: 2025-03-31"
    let month: string | null = null;
    const periodMatch = pdfText.match(/Period:\s+(\d{4})-(\d{2})-\d{2}/);
    if (periodMatch) {
        month = `${periodMatch[1]}-${periodMatch[2]}`;
    } else {
        const dateMatch = pdfText.match(/Date:\s+(\d{4})-(\d{2})-\d{2}/);
        if (dateMatch) {
            month = `${dateMatch[1]}-${dateMatch[2]}`;
        }
    }

    if (!month) {
        console.warn(`[EquityParser] Could not find period/date in ${sourceFileName}`);
        return false;
    }

    // 2. Find Account Summary section and extract balances
    const openingMatch = pdfText.match(/Opening Balance\s+\$?\s?([\d,.]+)/);
    const closingMatch = pdfText.match(/Closing Balance\s+\$?\s?([\d,.]+)/);

    if (!openingMatch || !closingMatch) {
        console.warn(`[EquityParser] Could not find Account Summary balances in ${sourceFileName}`);
        return false;
    }

    const openingBalance = cleanAmount(openingMatch[1]);
    const closingBalance = cleanAmount(closingMatch[1]);

    // 3. Store in alpha_nav_snapshots
    try {
        db.prepare(`
            INSERT INTO alpha_nav_snapshots (month, opening_balance, closing_balance, source_file)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(month) DO UPDATE SET
                opening_balance = excluded.opening_balance,
                closing_balance = excluded.closing_balance,
                source_file = excluded.source_file
        `).run(month, openingBalance, closingBalance, sourceFileName);
        return true;
    } catch (err) {
        console.error(`[EquityParser] Failed to insert NAV snapshot for ${month}:`, err);
        return false;
    }
}
