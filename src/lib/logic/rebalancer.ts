// src/lib/logic/rebalancer.ts
import db from '../db/client';
import { calculateHierarchicalMetrics } from './xray';
import { syncToMarkdown } from '../sync/markdown';
import { applyWashSaleGuard } from './rebalance/washSaleGuard';
import { getExpenseRisks, getTaxPlacementIssues } from './xray_risks';
import { mapIslands, solveIslands } from './rebalance/islandEngine';
import { getStrategicSettings } from '../db/settings';

const ENGINE_VERSION: 'v1' | 'v2' = 'v2';

export type DirectiveStatus = 'PENDING' | 'ACCEPTED' | 'SNOOZED' | 'EXECUTED';

export interface Directive {
    id?: number;
    type: 'SELL' | 'BUY' | 'REBALANCE' | 'OPTIMIZATION' | 'PLACEMENT';
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    reasoning: string;
    link_key: string;
    status?: DirectiveStatus;
    // V2 fields
    account_id?: string;
    asset_class?: string;
    scheduled_date?: string;
    tranche_index?: number;
    tranche_total?: number;
    amount?: number;
    source_ticker?: string; // Ticker being sold/trimmed
    target_ticker?: string; // Ticker being bought/swapped into
    source_asset_class?: string;
    target_asset_class?: string;
}

export function splitIntoTranches(directive: Omit<Directive, 'tranche_index' | 'tranche_total'>, accountLabel: string): Directive[] {
    const amount = directive.amount || 0;
    const settings = getStrategicSettings();
    const maxSize = settings.max_tranche_size || 20000;
    
    const count = Math.ceil(amount / maxSize);
    if (count <= 1) return [{ ...directive, tranche_index: 1, tranche_total: 1 } as Directive];
    
    const baseAmount = Math.floor(amount / count);
    const remainder = amount - baseAmount * count;

    return Array.from({ length: count }, (_, i) => {
        const trancheAmount = baseAmount + (i === count - 1 ? remainder : 0);
        const amountK = (trancheAmount / 1000).toFixed(1);
        
        let description = directive.description;
        if (directive.type === 'REBALANCE') {
            description = `Swap $${amountK}k ${directive.source_ticker} → ${directive.asset_class} (${directive.target_ticker}) in ${accountLabel}`;
        } else if (directive.type === 'SELL') {
            description = `Trim $${amountK}k ${directive.source_ticker} in ${accountLabel}`;
        } else if (directive.type === 'BUY') {
            description = `Buy $${amountK}k ${directive.asset_class} (${directive.target_ticker}) in ${accountLabel}`;
        } else {
            // For OPTIMIZATION and PLACEMENT, add tranche info
            description = `${directive.description} (Tranche ${i + 1}/${count}: $${amountK}k)`;
        }

        return {
            ...directive,
            description,
            amount: trancheAmount,
            tranche_index: i + 1,
            tranche_total: count,
        };
    });
}

export interface PersistedDirective extends Directive {
    id: number;
    status: DirectiveStatus;
    tranche_index: number;
    tranche_total: number;  // raw dollar amount for display
    account_nickname?: string;
    account_provider?: string;
}

export async function generateDirectives(): Promise<number> {
    const metrics = calculateHierarchicalMetrics();
    const allAccounts = db.prepare('SELECT * FROM accounts').all() as any[];
    const investable = allAccounts.filter(a => a.account_type !== 'BANKING' && a.provider !== 'UNKNOWN');
    
    if (investable.length === 0) return 0;

    let rawDirectives: Directive[] = [];

    if (ENGINE_VERSION === 'v2') {
        rawDirectives = await generateV2Directives(metrics, investable);
    }

    // 4. Tranche Splitting
    const accountLabels = new Map<string, string>();
    allAccounts.forEach(a => accountLabels.set(a.id, `${a.provider} ${a.nickname || a.id}`));

    const directives: Directive[] = [];
    rawDirectives.forEach(d => {
        if (d.account_id) {
            const label = accountLabels.get(d.account_id) || d.account_id;
            directives.push(...splitIntoTranches(d, label));
        } else {
            directives.push({ ...d, tranche_index: 1, tranche_total: 1 });
        }
    });

    // 5. Deduplicate against existing non-PENDING directives
    const existing = db.prepare("SELECT account_id, source_ticker, target_ticker, type, tranche_index, status FROM directives WHERE status != 'PENDING'").all() as any[];
    const existingKey = (d: any) => `${d.account_id}|${d.source_ticker}|${d.target_ticker}|${d.type}|${d.tranche_index}`;
    const existingSet = new Set(existing.map(existingKey));

    const finalDirectives = directives.filter(d => !existingSet.has(existingKey(d)));

    const insertDirective = db.prepare(`
        INSERT INTO directives (type, description, priority, status, reasoning, link_key, account_id, asset_class, tranche_index, tranche_total, amount, source_ticker, target_ticker, source_asset_class, target_asset_class)
        VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
        db.prepare("DELETE FROM directives WHERE status = 'PENDING'").run();
        finalDirectives.forEach(d =>
            insertDirective.run(
                d.type, d.description, d.priority, d.reasoning, d.link_key,
                d.account_id ?? null,
                d.asset_class ?? null,
                d.tranche_index ?? 1,
                d.tranche_total ?? 1,
                d.amount ?? null,
                d.source_ticker ?? null,
                d.target_ticker ?? null,
                d.source_asset_class ?? null,
                d.target_asset_class ?? null
            )
        );
    })();

    syncToMarkdown();
    return directives.length;
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
            description: `Swap ${risk.currentTicker} → ${risk.betterTicker} in ${risk.accountName}`,
            priority: 'MEDIUM',
            reasoning: `Eliminate ${risk.savingsBps.toFixed(1)} bps Excess Expense Ratio`,
            link_key: risk.currentTicker,
            amount: risk.currentValue,
            source_ticker: risk.currentTicker,
            target_ticker: risk.betterTicker,
            account_id: risk.accountId
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
            amount: issue.holdingValue,
            source_ticker: issue.ticker,
            target_ticker: issue.ticker, // Relocation is same asset
            account_id: issue.accountId
        });
    });

    return directives;
}
