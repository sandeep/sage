import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/client';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ date: string }> }
) {
    const { date } = await params;
    const body = await req.json();
    const label: string | null = typeof body.label === 'string' ? body.label.trim() || null : null;

    db.prepare(`
        INSERT INTO snapshot_metadata (snapshot_date, label)
        VALUES (?, ?)
        ON CONFLICT(snapshot_date) DO UPDATE SET label = excluded.label
    `).run(date, label);

    return NextResponse.json({ ok: true });
}
