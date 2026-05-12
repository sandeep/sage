import { NextResponse } from 'next/server';
import { getAuditTrail } from '@/lib/logic/auditService';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
        return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    
    return NextResponse.json(getAuditTrail(id));
}
