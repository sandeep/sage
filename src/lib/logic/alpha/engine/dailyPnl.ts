// src/lib/logic/alpha/engine/dailyPnl.ts
import db from '@/lib/db/client';

export async function aggregateDailyPnl() {
    db.transaction(() => {
        // 1. Clear existing P&L
        db.prepare('DELETE FROM alpha_daily_pnl').run();

        // 2. Aggregate P&L for each date
        const sql = `
            INSERT INTO alpha_daily_pnl (
                date,
                futures_pnl,
                options_pnl,
                equity_pnl,
                fees,
                income,
                deposits,
                daily_total
            )
            SELECT 
                date,
                SUM(futures_pnl) as futures_pnl,
                SUM(options_pnl) as options_pnl,
                SUM(equity_pnl) as equity_pnl,
                SUM(fees) as fees,
                SUM(income) as income,
                SUM(deposits) as deposits,
                SUM(futures_pnl + options_pnl + equity_pnl + fees + income) as daily_total
            FROM (
                -- Futures P&L (Prioritize reconstructed trades from PDF, fallback to CSV sweeps)
                SELECT 
                    date,
                    SUM(amount) as futures_pnl,
                    0 as options_pnl,
                    0 as equity_pnl,
                    0 as fees,
                    0 as income,
                    0 as deposits
                FROM (
                    -- Reconstructed trades from PDF (Deeper accuracy)
                    SELECT 
                        close_date as date, 
                        net_pnl as amount
                    FROM alpha_futures_trades
                    WHERE close_date IS NOT NULL

                    UNION ALL

                    -- CSV Sweeps (Fallback for dates without PDF data)
                    SELECT 
                        activity_date as date, 
                        amount
                    FROM alpha_transactions
                    WHERE trans_code = 'FUTSWP'
                      AND activity_date NOT IN (SELECT DISTINCT close_date FROM alpha_futures_trades)
                )
                GROUP BY date
                
                UNION ALL
                
                -- Options P&L (Realized on close)
                SELECT 
                    close_date as date, 
                    0 as futures_pnl, 
                    net_pnl as options_pnl, 
                    0 as equity_pnl, 
                    0 as fees, 
                    0 as income, 
                    0 as deposits
                FROM alpha_option_trades
                WHERE close_date IS NOT NULL
                
                UNION ALL
                
                -- Equity P&L (Realized on close)
                SELECT 
                    close_date as date, 
                    0 as futures_pnl, 
                    0 as options_pnl, 
                    net_pnl as equity_pnl, 
                    0 as fees, 
                    0 as income, 
                    0 as deposits
                FROM alpha_equity_trades
                WHERE close_date IS NOT NULL
                
                UNION ALL
                
                -- Fees (GOLD, MINT, etc)
                SELECT 
                    activity_date as date, 
                    0 as futures_pnl, 
                    0 as options_pnl, 
                    0 as equity_pnl, 
                    amount as fees, 
                    0 as income, 
                    0 as deposits
                FROM alpha_transactions
                WHERE book = 'FEE'
                
                UNION ALL
                
                -- Income (Interest, etc)
                SELECT 
                    activity_date as date, 
                    0 as futures_pnl, 
                    0 as options_pnl, 
                    0 as equity_pnl, 
                    0 as fees, 
                    amount as income, 
                    0 as deposits
                FROM alpha_transactions
                WHERE book = 'INCOME'
                
                UNION ALL
                
                -- External Cash Flow (ACH, Dividends from outside)
                SELECT 
                    activity_date as date, 
                    0 as futures_pnl, 
                    0 as options_pnl, 
                    0 as equity_pnl, 
                    0 as fees, 
                    0 as income, 
                    amount as deposits
                FROM alpha_transactions
                WHERE book = 'DEPOSIT'
            )
            GROUP BY date
            ORDER BY date
        `;
        
        db.prepare(sql).run();

        // 3. Calculate running cumulative_pnl and NAV
        const rows = db.prepare('SELECT * FROM alpha_daily_pnl ORDER BY date ASC').all() as any[];
        let cumulativePnl = 0;
        let cumulativeNav = 0;

        const updateStmt = db.prepare(`
            UPDATE alpha_daily_pnl 
            SET cumulative_pnl = ?, nav = ? 
            WHERE date = ?
        `);

        for (const row of rows) {
            cumulativePnl += row.daily_total;
            cumulativeNav += (row.daily_total + row.deposits);
            updateStmt.run(cumulativePnl, cumulativeNav, row.date);
        }

        console.log(`[DailyPnl] Aggregated ${rows.length} days. Current NAV: $${cumulativeNav.toLocaleString()}`);
    })();
}
