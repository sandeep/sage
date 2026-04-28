// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { parseGenericHoldings } from '@/lib/ingest/parsers';
import { ingestHoldings } from '@/lib/ingest';
import { generateDirectives } from '@/lib/logic/rebalancer';
import db from '@/lib/db/client';

export async function POST(req: NextRequest) {
    try {
        let csvData = '';
        let snapshotDate = new Date().toISOString().split('T')[0];

        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            const file = formData.get('file') as File;
            if (file) csvData = await file.text();
        } else {
            const body = await req.json();
            csvData = body.csvData;
            if (body.snapshotDate) snapshotDate = body.snapshotDate;
        }

        if (!csvData) return NextResponse.json({ error: 'No data provided' }, { status: 400 });

        const parseResult = parseGenericHoldings(csvData);
        
        // Group by account for ingestion
        const byAccount: Record<string, any[]> = {};
        parseResult.holdings.forEach(h => {
            if (!h.ticker) return;
            const accId = h.accountId || 'UNKNOWN_ACCOUNT';
            if (!byAccount[accId]) byAccount[accId] = [];
            byAccount[accId].push(h);
        });

        // Ingest each account
        let totalIngested = 0;
        for (const [accId, holdings] of Object.entries(byAccount)) {
            // Ensure account exists
            const exists = db.prepare('SELECT id FROM accounts WHERE id = ?').get(accId);
            if (!exists) {
                const accName = holdings[0]?.accountName || accId;
                db.prepare('INSERT INTO accounts (id, provider, tax_character, nickname) VALUES (?, ?, ?, ?)')
                  .run(accId, 'IMPORTED', 'TAXABLE', accName);
            }
            totalIngested += ingestHoldings(accId, holdings, snapshotDate);
        }

        await generateDirectives();

        // Generate Sankey Data for Step 3
        const nodes: any[] = [];
        const links: any[] = [];
        const nodeMap = new Map();

        const addNode = (id: string, label: string, type: string) => {
            const fullId = `${type}:${id}`;
            if (!nodeMap.has(fullId)) {
                nodes.push({ id: fullId, label, type });
                nodeMap.set(fullId, nodes.length - 1);
            }
            return fullId;
        };

        parseResult.holdings.forEach(h => {
            const accId = h.accountId || 'UNKNOWN_ACCOUNT';
            const accNodeId = addNode(accId, h.accountName || accId, 'account');
            const tickerNodeId = addNode(h.ticker, h.ticker, 'ticker');
            
            links.push({
                source: accNodeId,
                target: tickerNodeId,
                value: h.marketValue || 1
            });
        });

        return NextResponse.json({
            success: true,
            result: {
                ingested: totalIngested,
                skipped: parseResult.skipped,
                unmapped: parseResult.unmapped,
                sankey: { nodes, links }
            }
        });

    } catch (e: any) {
        console.error('[Upload] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
