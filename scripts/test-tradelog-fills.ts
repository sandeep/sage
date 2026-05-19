const tsConfig = require('tsconfig-paths/register');
const { getTradeLog } = require('./src/lib/logic/alpha/engine/metrics');

async function main() {
    try {
        const trades = await getTradeLog('Futures');
        const silTrade = trades.find((t: any) => t.instrument === 'SIL 2026-03' && t.date === '2026-01-13' && t.entry === 86.125 && t.exit === 83.65);
        if (!silTrade) {
            console.log('Trade not found!');
            return;
        }
        console.log('Fills count for this trade:', silTrade.fills ? silTrade.fills.length : 'undefined');
        if (silTrade.fills && silTrade.fills.length > 0) {
            console.log('First fill:', silTrade.fills[0]);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}
main();