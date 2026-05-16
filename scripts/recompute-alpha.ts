import { reconstructFuturesTrades } from '@/lib/logic/alpha/reconstruction/futuresTrades';
import { reconstructOptionTrades } from '@/lib/logic/alpha/reconstruction/optionTrades';
import { reconstructEquityTrades } from '@/lib/logic/alpha/reconstruction/equityTrades';
import { aggregateDailyPnl } from '@/lib/logic/alpha/engine/dailyPnl';

async function recompute() {
    console.log('Starting full recompute...');
    await reconstructFuturesTrades();
    await reconstructOptionTrades();
    await reconstructEquityTrades();
    await aggregateDailyPnl();
    console.log('Recompute finished.');
}

recompute();
