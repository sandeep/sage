// src/app/api/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runRefresh } from '../../../lib/data/refresh';

export async function POST() {
    try {
        const result = await runRefresh();
        return NextResponse.json({ ok: true, result });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        await runRefresh();
        // Redirect back to home
        return NextResponse.redirect(new URL('/', req.url));
    } catch (e: any) {
        console.error('[Refresh API] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
