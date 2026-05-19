const tsConfig = require('tsconfig-paths/register');
const { getTradeLog } = require('./src/lib/logic/alpha/engine/metrics');

async function main() {
    const trades = await getTradeLog('Futures');
    const sample = trades.find((t: any) => t.instrument === 'SIL 2026-03' && t.date === '2026-01-13');
    console.log(JSON.stringify(sample, null, 2));
}
main();