import db from '../db/client';

export interface AuditSnapshot {
    date: string;
    market_value: number;
}

export function getAuditTrail(identifier: string): AuditSnapshot[] {
    return db.prepare(`
        SELECT date, SUM(market_value) as market_value
        FROM snapshots 
        WHERE ticker = ? OR asset_class = ?
        GROUP BY date
        ORDER BY date DESC 
        LIMIT 3
    `).all(identifier, identifier) as AuditSnapshot[];
}
