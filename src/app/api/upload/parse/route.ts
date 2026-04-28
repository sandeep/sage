
import { NextRequest, NextResponse } from 'next/server';
import { parseGenericHoldings } from '@/lib/ingest/parsers';
import db from '@/lib/db/client';

export async function POST(req: NextRequest) {
    try {
        const { csvData } = await req.json();
        if (!csvData) {
            return NextResponse.json({ error: 'Missing csvData' }, { status: 400 });
        }

        const parseResult = parseGenericHoldings(csvData);
        
        // Fetch current balances for reconciliation
        const currentBalances: Record<string, number> = {};
        for (const acc of parseResult.detectedAccounts) {
            const row = db.prepare(`
                SELECT SUM(market_value) as total 
                FROM holdings 
                WHERE account_id = ?
            `).get(acc.id) as { total: number } | undefined;
            currentBalances[acc.id] = row?.total || 0;
        }
        
        return NextResponse.json({
            holdings: parseResult.holdings,
            skipped: parseResult.skipped,
            unmapped: parseResult.unmapped,
            detectedAccounts: parseResult.detectedAccounts,
            accountTotals: parseResult.accountTotals,
            currentBalances
        });
    } catch (e: any) {
        console.error('[Parse API] Error:', e);
        return NextResponse.json({ error: e.message || 'Failed to parse data' }, { status: 500 });
    }
}
