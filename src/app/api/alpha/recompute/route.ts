import { NextRequest, NextResponse } from 'next/server';
import { reconstructFuturesTrades } from '@/lib/logic/alpha/reconstruction/futuresTrades';
import { reconstructOptionTrades } from '@/lib/logic/alpha/reconstruction/optionTrades';
import { reconstructEquityTrades } from '@/lib/logic/alpha/reconstruction/equityTrades';
import { aggregateDailyPnl } from '@/lib/logic/alpha/engine/dailyPnl';
import { reconstructShadowVti } from '@/lib/logic/alpha/engine/shadowPortfolio';

export async function POST(req: NextRequest) {
    try {
        console.log('[Recompute] Starting full Alpha reconstruction...');
        const futuresCount = await reconstructFuturesTrades();
        const optionCount = await reconstructOptionTrades();
        const equityCount = await reconstructEquityTrades();
        console.log(`[Recompute] Trades Reconstructed - Futures: ${futuresCount}, Options: ${optionCount}, Equities: ${equityCount}`);
        
        await aggregateDailyPnl();
        console.log('[Recompute] Daily P&L aggregation complete.');

        await reconstructShadowVti();
        console.log('[Recompute] Shadow VTI reconstruction complete.');

        return NextResponse.json({
            success: true,
            summary: {
                futuresTrades: futuresCount,
                optionTrades: optionCount,
                equityTrades: equityCount
            }
        });
    } catch (err: any) {
        console.error('Recomputation error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
