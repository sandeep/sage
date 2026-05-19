const tsConfig = require('tsconfig-paths/register');
const { getTradeLog } = require('./src/lib/logic/alpha/engine/metrics');

async function test() {
    const trades = await getTradeLog('Futures');
    const silTrades = trades.filter((t: any) => t.instrument === 'SIL 2026-03' && t.date === '2026-01-13');
    console.log(JSON.stringify(silTrades.slice(0, 2), null, 2));
}

test().catch(console.error);