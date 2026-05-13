// src/lib/logic/auditService.ts
import db from '../db/client';

export interface AuditSnapshot {
    date: string;
    market_value: number;
}

/**
 * Fetches the last 3 snapshots for a given asset class or ticker to provide a data trail.
 */
export function getAuditTrail(identifier: string): AuditSnapshot[] {
    try {
        return db.prepare(`
            SELECT snapshot_date as date, SUM(market_value) as market_value
            FROM holdings_ledger 
            WHERE ticker = ? OR ticker IN (
                SELECT ticker FROM asset_registry WHERE asset_class = ?
            )
            GROUP BY snapshot_date
            ORDER BY snapshot_date DESC 
            LIMIT 3
        `).all(identifier, identifier) as AuditSnapshot[];
    } catch (e) {
        console.error(`[AuditService] Failed to fetch trail for ${identifier}:`, e);
        return [];
    }
}
