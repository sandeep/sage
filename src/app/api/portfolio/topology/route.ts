import { NextResponse } from 'next/server';
import db from '@/lib/db/client';

export async function GET() {
    try {
        // 1. Get Accounts
        const accounts = db.prepare('SELECT id, nickname as name FROM accounts').all() as any[];
        
        // 2. Get Holdings with Asset Type
        // Summing by (account_id, ticker) as requested
        const holdings = db.prepare(`
            SELECT h.account_id, h.ticker, SUM(h.market_value) as value, COALESCE(ar.asset_type, 'UNKNOWN') as asset_type
            FROM holdings h
            LEFT JOIN asset_registry ar ON h.ticker = ar.ticker
            GROUP BY h.account_id, h.ticker
        `).all() as any[];

        const nodes: any[] = [];
        const links: any[] = [];
        
        const nodeMap = new Map<string, any>();

        // Add account nodes
        accounts.forEach(acc => {
            const node = {
                id: acc.id,
                name: acc.name || acc.id,
                type: 'account',
                totalValue: 0
            };
            nodes.push(node);
            nodeMap.set(acc.id, node);
        });

        // Add ticker nodes and links
        holdings.forEach(h => {
            // Update account node totalValue
            const accountNode = nodeMap.get(h.account_id);
            if (accountNode) {
                accountNode.totalValue += (h.value || 0);
            }

            // Ensure ticker node exists
            if (!nodeMap.has(h.ticker)) {
                const tickerNode = {
                    id: h.ticker,
                    name: h.ticker,
                    type: 'ticker',
                    totalValue: 0
                };
                nodes.push(tickerNode);
                nodeMap.set(h.ticker, tickerNode);
            }
            
            // Update ticker node totalValue
            const tickerNode = nodeMap.get(h.ticker);
            tickerNode.totalValue += (h.value || 0);

            // Add link
            links.push({
                source: h.account_id,
                target: h.ticker,
                value: h.value || 0,
                assetType: h.asset_type
            });
        });

        return NextResponse.json({ nodes, links });
    } catch (error) {
        console.error('Topology API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
