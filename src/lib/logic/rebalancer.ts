// src/lib/logic/rebalancer.ts
import db from '../db/client';
import { calculateHierarchicalMetrics } from './xray';
import { syncToMarkdown } from '../sync/markdown';
import { applyWashSaleGuard } from './rebalance/washSaleGuard';
import { getExpenseRisks, getTaxPlacementIssues } from './xray_risks';
import { mapIslands, solveIslands } from './rebalance/islandEngine';

const ENGINE_VERSION: 'v1' | 'v2' = 'v2';

export type DirectiveStatus = 'PENDING' | 'ACCEPTED' | 'SNOOZED' | 'EXECUTED';

export interface Directive {
    id: number;
    type: 'SELL' | 'BUY' | 'REBALANCE' | 'OPTIMIZATION' | 'PLACEMENT';
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    reasoning: string;
    link_key: string;
    status: DirectiveStatus;
    // V2 fields
    account_id?: string;
    asset_class?: string;
    scheduled_date?: string;
    tranche_index: number;
    tranche_total: number;
    amount?: number;  // raw dollar amount for display
}

export async function generateDirectives(): Promise<number> {
    const metrics = calculateHierarchicalMetrics();
    const allAccounts = db.prepare('SELECT * FROM accounts').all() as any[];
    const investable = allAccounts.filter(a => a.account_type !== 'BANKING' && a.provider !== 'UNKNOWN');
    
    if (investable.length === 0) return 0;

    let directives: Directive[] = [];

    if (ENGINE_VERSION === 'v2') {
        directives = await generateV2Directives(metrics, investable);
    }

    const insertDirective = db.prepare(`
        INSERT INTO directives (type, description, priority, status, reasoning, link_key, account_id, asset_class, tranche_index, tranche_total, amount)
        VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
        // Only wipe PENDING — preserve SCHEDULED/EXECUTED/SNOOZED
        db.prepare("DELETE FROM directives WHERE status = 'PENDING'").run();
        directives.forEach(d =>
            insertDirective.run(
                d.type, d.description, d.priority, d.reasoning, d.link_key,
                d.account_id ?? null,
                d.asset_class ?? null,
                d.tranche_index ?? 1,
                d.tranche_total ?? 1,
                d.amount ?? null
            )
        );
    })();

    syncToMarkdown();
    return directives.length;
}

/**
 * Maps a category label (e.g. "Small Cap Value") to its preferred target ticker,
 * being mindful of the account venue (Provider).
 */
export function resolveTickerForCategory(label: string, provider?: string): string {
    // 1. Try to find a core fund matching the PROVIDER (e.g. Fidelity -> FZROX)
    if (provider) {
        const providerMatch = db.prepare(`
            SELECT ticker FROM asset_registry 
            WHERE weights LIKE ? 
            AND (description LIKE ? OR ticker LIKE ?)
            AND is_core = 1
            LIMIT 1
        `).get(`%"${label}":1%`, `%${provider}%`, `${provider[0]}%`) as { ticker: string } | undefined;
        
        if (providerMatch) return providerMatch.ticker;
    }

    // 2. Fallback: Find any CORE ETF for this category
    const coreEtf = db.prepare(`
        SELECT ticker FROM asset_registry 
        WHERE weights LIKE ? 
        AND asset_type = 'ETF'
        AND is_core = 1
        LIMIT 1
    `).get(`%"${label}":1%`) as { ticker: string } | undefined;
    
    if (coreEtf) return coreEtf.ticker;

    // 3. Last Resort: Any matching ticker
    const anyMatch = db.prepare(`
        SELECT ticker FROM asset_registry 
        WHERE weights LIKE ? 
        LIMIT 1
    `).get(`%"${label}":1%`) as { ticker: string } | undefined;

    return anyMatch ? anyMatch.ticker : label;
}

async function generateV2Directives(metrics: any[], accounts: any[]): Promise<Directive[]> {
    // 1. Run the Island Solver (New v3 Logic)
    const islands = mapIslands();
    let directives = solveIslands(islands);

    // 2. Apply Wash Sale Guard
    directives = applyWashSaleGuard(directives);

    // 3. Structural Pass (Optimization & Placement)
    const feeRisks = getExpenseRisks();
    feeRisks.forEach(risk => {
        directives.push({
            type: 'OPTIMIZATION',
            description: `Swap ${risk.currentTicker} → ${risk.betterTicker} in Fidelity Individual`, // Heuristic account mapping
            priority: 'MEDIUM',
            reasoning: `Eliminate ${risk.savingsBps.toFixed(1)} bps Excess Expense Ratio`,
            link_key: risk.currentTicker,
            amount: risk.potentialSavings
        });
    });

    const taxIssues = getTaxPlacementIssues();
    taxIssues.forEach(issue => {
        directives.push({
            type: 'PLACEMENT',
            description: `Relocate ${issue.ticker} to ${issue.preferredAccountType}`,
            priority: issue.type === 'LEAKAGE' ? 'HIGH' : 'MEDIUM',
            reasoning: `Structural ${issue.type}: Asset belongs in tax-sheltered venue`,
            link_key: issue.ticker,
            amount: issue.holdingValue
        });
    });

    return directives;
}
