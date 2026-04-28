// src/app/api/accounts/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db/client';
import { getHoldings } from '@/lib/logic/portfolioEngine';

export async function GET() {
    const allHoldings = getHoldings();
    const accounts = db.prepare(`SELECT * FROM accounts`).all() as any[];
    
    const accountsWithValues = accounts.map(acc => {
        const total_value = allHoldings
            .filter(h => h.account_id === acc.id)
            .reduce((sum, h) => sum + (h.market_value || 0), 0);
        return { ...acc, total_value };
    });

    return NextResponse.json(accountsWithValues);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, tax_character, account_type, allowed_tickers, nickname } = body;

        // Dynamic update based on provided fields
        const fields = [];
        const values = [];

        if (tax_character !== undefined) { fields.push('tax_character = ?'); values.push(tax_character); }
        if (account_type !== undefined) { fields.push('account_type = ?'); values.push(account_type); }
        if (allowed_tickers !== undefined) { fields.push('allowed_tickers = ?'); values.push(allowed_tickers); }
        if (nickname !== undefined) { fields.push('nickname = ?'); values.push(nickname || null); }
        
        if (fields.length > 0) {
            values.push(id);
            db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        }
          
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
    }
}
