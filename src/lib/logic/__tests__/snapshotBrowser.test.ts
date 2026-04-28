import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db/client';
import { setupTestDb } from '@/lib/db/__tests__/setup';
import { getSnapshotHeadline, getSnapshotRows, getSnapshotExpansion, getSnapshotTrail } from '@/lib/logic/snapshotBrowser';

describe('getSnapshotHeadline', () => {
    beforeEach(() => {
        setupTestDb();
        db.exec(`
            INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'Fidelity', 'ROTH');
        `);
    });

    it('returns null when ledger is empty', () => {
        expect(getSnapshotHeadline()).toBeNull();
    });

    it('returns null when only one snapshot exists', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2024-12-01', 'acc1', 'VTI', 100, 'EQUITY', 20000);
        `);
        expect(getSnapshotHeadline()).toBeNull();
    });

    it('returns headline with correct growth when two snapshots exist', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2024-12-01', 'acc1', 'VTI', 100, 'EQUITY', 20000);
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2025-06-01', 'acc1', 'VTI', 110, 'EQUITY', 25000);
        `);
        const h = getSnapshotHeadline();
        expect(h).not.toBeNull();
        expect(h!.firstDate).toBe('2024-12-01');
        expect(h!.latestDate).toBe('2025-06-01');
        expect(h!.firstValue).toBe(20000);
        expect(h!.latestValue).toBe(25000);
        expect(h!.growthDollars).toBe(5000);
        expect(h!.growthPct).toBeCloseTo(0.25, 4);
        expect(h!.monthsElapsed).toBe(6);
    });
});

describe('getSnapshotRows', () => {
    beforeEach(() => {
        setupTestDb();
        db.exec(`
            INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'Fidelity', 'ROTH');
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type)
            VALUES ('VTI', 'Vanguard Total Stock', '{"Total Stock Market": 1.0}', 'ETF');
        `);
    });

    it('returns empty array when ledger is empty', () => {
        expect(getSnapshotRows()).toEqual([]);
    });

    it('returns one row with null growth for single snapshot', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2024-12-01', 'acc1', 'VTI', 100, 'EQUITY', 20000);
        `);
        const rows = getSnapshotRows();
        expect(rows).toHaveLength(1);
        expect(rows[0].snapshotDate).toBe('2024-12-01');
        expect(rows[0].totalValue).toBe(20000);
        expect(rows[0].growthDollars).toBeNull();
        expect(rows[0].positionCount).toBe(1);
    });

    it('returns two rows ordered newest first with growth on the latest', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2024-12-01', 'acc1', 'VTI', 100, 'EQUITY', 20000);
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2025-06-01', 'acc1', 'VTI', 110, 'EQUITY', 25000);
        `);
        const rows = getSnapshotRows();
        expect(rows[0].snapshotDate).toBe('2025-06-01');
        expect(rows[0].growthDollars).toBe(5000);
        expect(rows[0].growthPct).toBeCloseTo(0.25, 4);
        expect(rows[1].growthDollars).toBeNull();
    });

    it('computes stock-heavy mix for VTI portfolio', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2025-01-01', 'acc1', 'VTI', 100, 'EQUITY', 10000);
        `);
        const rows = getSnapshotRows();
        expect(rows[0].mix.stockPct).toBe(100);
        expect(rows[0].mix.bondPct).toBe(0);
    });
});

describe('getSnapshotExpansion', () => {
    beforeEach(() => {
        setupTestDb();
        db.exec(`
            INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'Fidelity', 'ROTH');
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type)
            VALUES ('VTI', 'Vanguard Total Stock', '{"Total Stock Market": 1.0}', 'ETF');
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2025-01-01', 'acc1', 'VTI', 100, 'EQUITY', 10000);
        `);
    });

    it('returns holdings with correct weight', () => {
        const exp = getSnapshotExpansion('2025-01-01', null);
        expect(exp.holdings).toHaveLength(1);
        expect(exp.holdings[0].ticker).toBe('VTI');
        expect(exp.holdings[0].weightPct).toBeCloseTo(100, 1);
    });

    it('returns empty movers when no previous snapshot', () => {
        const exp = getSnapshotExpansion('2025-01-01', null);
        expect(exp.movers).toHaveLength(0);
    });

    it('returns movers when previous snapshot exists', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2024-12-01', 'acc1', 'VTI', 80, 'EQUITY', 8000);
        `);
        const exp = getSnapshotExpansion('2025-01-01', '2024-12-01');
        // VTI was 100% in both, so delta is 0
        expect(exp.movers).toHaveLength(1);
        expect(exp.movers[0].deltaPct).toBeCloseTo(0, 1);
    });
});

describe('getSnapshotTrail', () => {
    beforeEach(() => {
        setupTestDb();
        db.exec(`
            INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'Fidelity', 'ROTH');
            INSERT INTO asset_registry (ticker, canonical, weights, asset_type)
            VALUES ('VTI', 'Vanguard Total Stock', '{"Total Stock Market": 1.0}', 'ETF');
        `);
    });

    it('returns empty array when ledger is empty', () => {
        expect(getSnapshotTrail()).toEqual([]);
    });

    it('returns one point per snapshot with numeric return and vol', () => {
        db.exec(`
            INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type, market_value)
            VALUES ('2025-01-01', 'acc1', 'VTI', 100, 'EQUITY', 10000);
        `);
        const trail = getSnapshotTrail();
        expect(trail).toHaveLength(1);
        expect(typeof trail[0].return).toBe('number');
        expect(typeof trail[0].vol).toBe('number');
    });
});
