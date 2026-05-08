import { NextResponse } from 'next/server';
import { generateAuditReport } from '@/lib/logic/auditEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const report = await generateAuditReport();
        return NextResponse.json(report);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
