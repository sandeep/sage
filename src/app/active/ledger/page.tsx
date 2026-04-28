import React from 'react';
import { getTradeLog } from '@/lib/logic/alpha/engine/metrics';
import TradeLogClient from './TradeLogClient';

export const dynamic = 'force-dynamic';

export default async function TradeLogPage() {
    const futures = await getTradeLog('Futures');
    const options = await getTradeLog('Options');
    const equities = await getTradeLog('Equities');

    return (
        <main className="min-h-screen bg-black text-white font-mono selection:bg-emerald-500/30">
            <TradeLogClient 
                initialFutures={futures} 
                initialOptions={options} 
                initialEquities={equities} 
            />
        </main>
    );
}
