import db from '@/lib/db/client';

export interface AlphaYearlyTax {
    year: string;
    shortTermGains: number;
    longTermGains: number;
    estimatedLiability: number;
    effectiveRate: number;
    breakdown: {
        futures: { stcg: number; ltcg: number; total: number };
        options: { stcg: number; total: number };
        equities: { stcg: number; ltcg: number; total: number };
    };
}

const LTCG_RATE = 0.20;
const STCG_RATE = 0.37;

export async function calculateAlphaTaxLiability(): Promise<AlphaYearlyTax[]> {
    // Get all relevant years
    const yearsRows = db.prepare(`
        SELECT DISTINCT substr(close_date, 1, 4) as year FROM alpha_futures_trades WHERE close_date IS NOT NULL
        UNION
        SELECT DISTINCT substr(close_date, 1, 4) as year FROM alpha_option_trades WHERE close_date IS NOT NULL
        UNION
        SELECT DISTINCT substr(close_date, 1, 4) as year FROM alpha_equity_trades WHERE close_date IS NOT NULL
        ORDER BY year DESC
    `).all() as { year: string }[];

    const results: AlphaYearlyTax[] = [];

    for (const { year } of yearsRows) {
        if (!year) continue;

        // 1. Futures (Section 1256): 60% LTCG, 40% STCG
        const futuresPnl = db.prepare(`
            SELECT SUM(net_pnl) as total FROM alpha_futures_trades 
            WHERE substr(close_date, 1, 4) = ?
        `).get(year) as { total: number | null };
        
        const totalFutures = futuresPnl?.total || 0;
        const futuresLtcg = totalFutures * 0.60;
        const futuresStcg = totalFutures * 0.40;

        // 2. Options: 100% STCG
        const optionsPnl = db.prepare(`
            SELECT SUM(net_pnl) as total FROM alpha_option_trades 
            WHERE substr(close_date, 1, 4) = ? AND close_date IS NOT NULL
        `).get(year) as { total: number | null };
        
        const totalOptions = optionsPnl?.total || 0;
        const optionsStcg = totalOptions;

        // 3. Equities
        const equityGains = db.prepare(`
            SELECT 
                SUM(CASE WHEN hold_days > 365 THEN net_pnl ELSE 0 END) as ltcg,
                SUM(CASE WHEN hold_days <= 365 THEN net_pnl ELSE 0 END) as stcg
            FROM alpha_equity_trades 
            WHERE substr(close_date, 1, 4) = ? AND close_date IS NOT NULL
        `).get(year) as { ltcg: number | null, stcg: number | null };

        const equityLtcg = equityGains?.ltcg || 0;
        const equityStcg = equityGains?.stcg || 0;

        const totalStcg = futuresStcg + optionsStcg + equityStcg;
        const totalLtcg = futuresLtcg + equityLtcg;
        const totalGains = totalStcg + totalLtcg;

        const estimatedLiability = (totalStcg * STCG_RATE) + (totalLtcg * LTCG_RATE);
        const effectiveRate = totalGains > 0 ? estimatedLiability / totalGains : 0;

        results.push({
            year,
            shortTermGains: totalStcg,
            longTermGains: totalLtcg,
            estimatedLiability,
            effectiveRate,
            breakdown: {
                futures: { stcg: futuresStcg, ltcg: futuresLtcg, total: totalFutures },
                options: { stcg: optionsStcg, total: totalOptions },
                equities: { stcg: equityStcg, ltcg: equityLtcg, total: equityStcg + equityLtcg }
            }
        });
    }

    return results;
}
