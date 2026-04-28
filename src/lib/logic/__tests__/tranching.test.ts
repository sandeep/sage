import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';
import { generateReconciliationTrades } from '../rebalance/frictionBridge';

describe('tranche splitting', () => {
    beforeEach(() => { setupTestDb(); });

    it('splits a $50k buy into three $20k tranches', () => {
        const idealMap = { 'acc1': { 'VTI': 50000 } };
        const actualMap = { 'acc1': {} };
        const accountMeta = new Map([['acc1', { label: 'Test 401k', provider: 'VANGUARD' }]]);

        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'VANGUARD', 'DEFERRED')").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) VALUES ('VTI', 'Vanguard Total Market', '{\"Total Stock Market\":1.0}', 'ETF', 1)").run();

        const directives = generateReconciliationTrades(idealMap, actualMap, accountMeta);
        const vtiBuys = directives.filter(d => d.account_id === 'acc1' && d.asset_class === 'Total Stock Market');

        expect(vtiBuys.length).toBe(3);
        expect(vtiBuys[0].tranche_index).toBe(1);
        expect(vtiBuys[0].tranche_total).toBe(3);
        expect(vtiBuys[1].tranche_index).toBe(2);
        expect(vtiBuys[2].tranche_index).toBe(3);
        // Each tranche ≤ $20k
        vtiBuys.forEach(d => expect(d.amount!).toBeLessThanOrEqual(20000));
    });

    it('a $15k buy is a single tranche', () => {
        const idealMap = { 'acc1': { 'VTI': 15000 } };
        const actualMap = { 'acc1': {} };
        const accountMeta = new Map([['acc1', { label: 'Test 401k', provider: 'VANGUARD' }]]);

        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'VANGUARD', 'DEFERRED')").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) VALUES ('VTI', 'Vanguard Total Market', '{\"Total Stock Market\":1.0}', 'ETF', 1)").run();

        const directives = generateReconciliationTrades(idealMap, actualMap, accountMeta);
        const vtiBuys = directives.filter(d => d.account_id === 'acc1');

        expect(vtiBuys.length).toBe(1);
        expect(vtiBuys[0].tranche_total).toBe(1);
    });

    it('directives carry account_id and asset_class', () => {
        const idealMap = { 'acc1': { 'VTI': 10000 } };
        const actualMap = { 'acc1': {} };
        const accountMeta = new Map([['acc1', { label: 'Test 401k', provider: 'VANGUARD' }]]);

        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'VANGUARD', 'DEFERRED')").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) VALUES ('VTI', 'VTI', '{\"Total Stock Market\":1.0}', 'ETF', 1)").run();

        const directives = generateReconciliationTrades(idealMap, actualMap, accountMeta);
        expect(directives[0].account_id).toBe('acc1');
        expect(directives[0].asset_class).toBe('Total Stock Market');
    });
});
