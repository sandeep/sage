// src/app/api/macro/route.ts
import { NextResponse } from 'next/server';
import { getYieldCurveState } from '@/lib/logic/macro';

export async function GET() {
    try {
        const macro = await getYieldCurveState();
        return NextResponse.json(macro);
    } catch (error) {
        return NextResponse.json({ state: 'NORMAL', spread: 0.5 }, { status: 500 });
    }
}
