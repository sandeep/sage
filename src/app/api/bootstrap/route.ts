import { NextResponse } from 'next/server';
import { bootstrap } from '@/lib/db/bootstrap';

export async function POST() {
    try {
        bootstrap();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
