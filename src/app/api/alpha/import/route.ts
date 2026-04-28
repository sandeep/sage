import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/client';
import { detectFileType } from '@/lib/logic/alpha/parser/detectFileType';
import { parseTransactionCsv, ParseSummary } from '@/lib/logic/alpha/parser/csvParser';
import { parseEquityStatement } from '@/lib/logic/alpha/parser/equityStatementParser';
import { parseFuturesStatement } from '@/lib/logic/alpha/parser/futuresStatementParser';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const files = formData.getAll('files') as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No files provided' }, { status: 400 });
        }

        const results = [];
        const importedAt = new Date().toISOString();

        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const fileName = file.name;
            let fileType: any = 'UNKNOWN';
            let recordsParsed = 0;
            let duplicatesCount = 0;
            let skippedCount = 0;
            let status: 'OK' | 'DUPLICATE_SKIPPED' | 'ERROR' = 'OK';
            let errorMsg: string | null = null;
            let firstPageText = '';

            try {
                if (fileName.toLowerCase().endsWith('.pdf')) {
                    try {
                        const pdf = require('pdf-parse');
                        const data = await pdf(buffer);
                        firstPageText = data.text;
                    } catch (pdfErr: any) {
                        console.error('PDF Parse internal error:', pdfErr);
                        throw new Error(`PDF engine failure: ${pdfErr.message}`);
                    }
                }

                fileType = detectFileType(fileName, firstPageText);

                if (fileType === 'CSV') {
                    const content = buffer.toString('utf-8');
                    const summary: ParseSummary = await parseTransactionCsv(content, fileName);
                    recordsParsed = summary.ingested;
                    duplicatesCount = summary.duplicates;
                    skippedCount = summary.skipped;
                    
                    if (recordsParsed === 0 && duplicatesCount > 0) {
                        status = 'DUPLICATE_SKIPPED';
                        errorMsg = `All ${duplicatesCount} transactions already exist in ledger.`;
                    } else if (recordsParsed === 0 && skippedCount > 0) {
                        status = 'ERROR';
                        errorMsg = `Failed to parse ${skippedCount} rows. Check date formats.`;
                    }
                } else if (fileType === 'EQUITY_STATEMENT') {
                    const success = await parseEquityStatement(firstPageText, fileName);
                    recordsParsed = success ? 1 : 0;
                } else if (fileType === 'FUTURES_STATEMENT') {
                    recordsParsed = await parseFuturesStatement(firstPageText, fileName);
                } else if (fileType === 'APEX_LEGACY') {
                    status = 'DUPLICATE_SKIPPED';
                    errorMsg = 'Apex Clearing legacy format not supported';
                } else {
                    status = 'ERROR';
                    errorMsg = 'Unrecognized file format';
                }

            } catch (err: any) {
                console.error(`Error processing file ${fileName}:`, err);
                status = 'ERROR';
                errorMsg = err.message || 'Unknown error';
            }

            // Log import to DB
            try {
                db.prepare(`
                    INSERT INTO alpha_import_log (
                        imported_at, source_file, file_type, status, records_parsed, error_msg
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `).run(importedAt, fileName, fileType, status, recordsParsed, errorMsg);
            } catch (dbErr) {
                console.error('Failed to log import to DB:', dbErr);
            }

            results.push({
                fileName,
                fileType,
                status,
                recordsParsed,
                duplicatesCount,
                skippedCount,
                errorMsg
            });
        }

        return NextResponse.json({ results });
    } catch (err: any) {
        console.error('Global Alpha Import route error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
