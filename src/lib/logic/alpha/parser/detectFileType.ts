
export type FileType = 'CSV' | 'EQUITY_STATEMENT' | 'FUTURES_STATEMENT' | 'APEX_LEGACY' | 'UNKNOWN';

/**
 * Detects the type of file based on its extension and content (if PDF).
 * 
 * CSV extension → transaction CSV
 * PDF, first-page text contains:
 *   "ROBINHOOD DERIVATIVES" → futures statement
 *   "Individual Investing" → equity statement (modern format, 2018+)
 *   "Apex Clearing" → equity statement (legacy format, pre-2019 — skip gracefully)
 */
export function detectFileType(fileName: string, firstPageText?: string): FileType {
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
        return 'CSV';
    }

    if (extension === 'pdf' && firstPageText) {
        if (firstPageText.includes('ROBINHOOD DERIVATIVES')) {
            return 'FUTURES_STATEMENT';
        }
        if (firstPageText.includes('Individual Investing')) {
            return 'EQUITY_STATEMENT';
        }
        if (firstPageText.includes('Apex Clearing')) {
            return 'APEX_LEGACY';
        }
    }

    return 'UNKNOWN';
}
