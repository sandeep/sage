// src/instrumentation.ts
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        try {
            const db = (await import('./lib/db/client')).default;
            const { runRefresh } = await import('./lib/data/refresh');

            const STALE_THRESHOLD_HOURS = 4;
            let lastFetched: string | null = null;

            try {
                const res = db.prepare("SELECT MAX(fetched_at) as t FROM ticker_meta").get() as { t: string | null };
                lastFetched = res?.t || null;
            } catch (e) {
                console.warn("Instrumentation: ticker_meta table or fetched_at column not found, assuming stale.");
            }

            const isStale = !lastFetched || (Date.now() - new Date(lastFetched).getTime()) > STALE_THRESHOLD_HOURS * 3600 * 1000;

            if (isStale) {
                console.log('Price data is stale — running refresh...');
                runRefresh().then(result => {
                    console.log(`Refresh complete: ${result.updated} updated, ${result.failed.length} failed`);
                }).catch(err => {
                    console.error('Refresh task failed:', err.message);
                });
            }
        } catch (criticalError: any) {
            console.error('CRITICAL: Instrumentation failed:', criticalError.message);
        }
    }
}
