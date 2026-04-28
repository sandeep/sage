// src/app/api/directives/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db/client';

const VALID_STATUSES = ['ACCEPTED', 'SNOOZED', 'EXECUTED', 'SCHEDULED'];

export async function POST(request: Request) {
    try {
        const { id, status, scheduled_date } = await request.json();

        if (!id || !VALID_STATUSES.includes(status)) {
            return NextResponse.json({ error: 'Invalid status update' }, { status: 400 });
        }

        if (status === 'SCHEDULED') {
            if (!scheduled_date || !/^\d{4}-\d{2}-\d{2}$/.test(scheduled_date)) {
                return NextResponse.json({ error: 'scheduled_date required (YYYY-MM-DD)' }, { status: 400 });
            }
            db.prepare("UPDATE directives SET status = 'SCHEDULED', scheduled_date = ? WHERE id = ?").run(scheduled_date, id);
        } else if (status === 'EXECUTED') {
            db.prepare("UPDATE directives SET status = 'EXECUTED', executed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
        } else {
            db.prepare("UPDATE directives SET status = ? WHERE id = ?").run(status, id);
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to update directive' }, { status: 500 });
    }
}
