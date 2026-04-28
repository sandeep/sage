import db from '../db/client';
import { getLatestPrice } from '../db/prices';
import { PLACEMENT_PRIORITY, AccountType } from './taxPlacement';
import { getStrategicSettings } from '../db/settings';
import { getHoldings } from './portfolioEngine';

export interface DragMetric { totalDragBps: number; locationDragBps: number; expenseDragBps: number; }

export function calculatePortfolioEfficiency(): DragMetric {
    try {
        const settings = getStrategicSettings();
        
        function getTaxRate(accountType: string, isOrdinary: boolean): number {
            if (accountType === 'TAXABLE') {
                return isOrdinary ? settings.ordinary_tax_rate : settings.dividend_tax_rate;
            }
            return 0; // Roth and Deferred have 0 current tax drag on yield
        }

        const holdings = getHoldings() || [];
        if (holdings.length === 0) return { totalDragBps: 0, locationDragBps: 0, expenseDragBps: 0 };

        let allAccounts: { tax_character: string }[] = [];
        try {
            allAccounts = db.prepare(`SELECT DISTINCT tax_character FROM accounts`).all() as { tax_character: string }[];
        } catch (e: any) {
            console.warn("Efficiency: accounts table query failed", e.message);
        }
        const availableTypes = allAccounts.map(a => a.tax_character as AccountType);

        let totalValue = 0, totalLocationLeakage = 0, totalExpenseLeakage = 0;

        holdings.forEach(h => {
            let value: number = 0;
            if (h.market_value !== null && h.market_value > 0) {
                value = h.market_value;
            } else {
                const price = getLatestPrice(h.ticker);
                if (price === null) return; 
                value = (h.quantity || 0) * price;
            }
            totalValue += value;

            let meta: { yield: number | null; er: number | null } | undefined;
            try {
                meta = db.prepare(`SELECT yield, er FROM ticker_meta WHERE ticker = ?`).get(h.ticker) as any;
            } catch (e) {
                // Ignore missing ticker_meta table or columns
            }
            
            const effectiveER = h.custom_er !== null ? h.custom_er : meta?.er;
            if (effectiveER != null) totalExpenseLeakage += value * effectiveER;

            if (meta?.yield != null && h.weights) {
                try {
                    const w = JSON.parse(h.weights) as Record<string, number>;
                    const primaryLabel = Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0];
                    
                    if (primaryLabel && PLACEMENT_PRIORITY[primaryLabel]) {
                        const rule = PLACEMENT_PRIORITY[primaryLabel];
                        const isOrdinary = rule.tier === 'very_inefficient' || rule.tier === 'inefficient';
                        
                        const currentRate = getTaxRate(h.tax_character, isOrdinary);
                        const preferredType = rule.priority.find(t => availableTypes.includes(t)) ?? (h.tax_character as AccountType);
                        const preferredRate = getTaxRate(preferredType, isOrdinary);

                        if (currentRate > preferredRate) {
                            totalLocationLeakage += value * meta.yield * (currentRate - preferredRate);
                        }
                    }
                } catch { /* ignore malformed weights */ }
            }
        });

        if (totalValue === 0) return { totalDragBps: 0, locationDragBps: 0, expenseDragBps: 0 };
        const locationDragBps = (totalLocationLeakage / totalValue) * 10000;
        const expenseDragBps = (totalExpenseLeakage / totalValue) * 10000;
        return { totalDragBps: locationDragBps + expenseDragBps, locationDragBps, expenseDragBps };
    } catch (criticalError: any) {
        console.error("CRITICAL: calculatePortfolioEfficiency failed", criticalError.message);
        return { totalDragBps: 0, locationDragBps: 0, expenseDragBps: 0 };
    }
}
