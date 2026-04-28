import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db/client';
import { setupTestDb } from '@/lib/db/__tests__/setup';
import { GET } from '../route';

describe('GET /api/portfolio/topology', () => {
    beforeEach(() => {
        setupTestDb();
        
        // Setup Accounts
        db.prepare("INSERT INTO accounts (id, nickname, provider, tax_character) VALUES ('acc1', 'Taxable', 'Fidelity', 'TAXABLE')").run();
        db.prepare("INSERT INTO accounts (id, nickname, provider, tax_character) VALUES ('acc2', 'Roth IRA', 'Vanguard', 'ROTH')").run();
        
        // Setup Asset Registry
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type) VALUES ('VTI', 'VTI', '{}', 'EQUITY')").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type) VALUES ('VXUS', 'VXUS', '{}', 'EQUITY')").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type) VALUES ('BND', 'BND', '{}', 'FIXED_INCOME')").run();
        
        // Setup Holdings
        db.prepare("INSERT INTO holdings (account_id, ticker, quantity, asset_type, market_value) VALUES ('acc1', 'VTI', 10, 'EQUITY', 2500)").run();
        db.prepare("INSERT INTO holdings (account_id, ticker, quantity, asset_type, market_value) VALUES ('acc1', 'VXUS', 20, 'EQUITY', 1200)").run();
        db.prepare("INSERT INTO holdings (account_id, ticker, quantity, asset_type, market_value) VALUES ('acc2', 'BND', 50, 'FIXED_INCOME', 4000)").run();
    });

    it('returns structured nodes and links for the topology', async () => {
        const res = await GET();
        expect(res.status).toBe(200);
        
        const data = await res.json();
        expect(data).toHaveProperty('nodes');
        expect(data).toHaveProperty('links');
        
        // Verify nodes (Accounts + Tickers)
        // acc1, acc2, VTI, VXUS, BND = 5 nodes
        expect(data.nodes.length).toBe(5);
        
        const nodeIds = data.nodes.map((n: any) => n.id);
        expect(nodeIds).toContain('acc1');
        expect(nodeIds).toContain('acc2');
        expect(nodeIds).toContain('VTI');
        expect(nodeIds).toContain('VXUS');
        expect(nodeIds).toContain('BND');
        
        // Verify links
        // acc1 -> VTI (2500)
        // acc1 -> VXUS (1200)
        // acc2 -> BND (4000)
        expect(data.links.length).toBe(3);
        
        const linkVTI = data.links.find((l: any) => l.source === 'acc1' && l.target === 'VTI');
        expect(linkVTI.value).toBe(2500);
        expect(linkVTI.assetType).toBe('EQUITY');
        
        const linkBND = data.links.find((l: any) => l.source === 'acc2' && l.target === 'BND');
        expect(linkBND.value).toBe(4000);
        expect(linkBND.assetType).toBe('FIXED_INCOME');
    });
});
