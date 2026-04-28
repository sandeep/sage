// src/app/api/purge/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db/client';

export async function POST() {
    try {
        db.transaction(() => {
            db.prepare('DELETE FROM holdings').run();
            db.prepare('DELETE FROM directives').run();
            // Protected tables — never purged:
            //   accounts         — user-defined account mapping
            //   asset_registry   — static fund/ETF definitions + custom_er overrides
            //   price_history    — fetched price data (expensive to re-fetch, AV 25 req/day limit)
            //   ticker_meta      — return1y and other computed metadata
            //   etf_composition  — scraped ETF holdings (30-day cache, rate-limited)
            //   allocation_nodes / allocation_versions — user allocation targets + history
        })();
        
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
