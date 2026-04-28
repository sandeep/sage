
import { describe, it, expect, beforeEach } from 'vitest';
import { getTaxPlacementIssues } from '../xray_risks';
import db from '../../db/client';
import { setupTestDb } from '../../../lib/db/__tests__/setup';

describe('getTaxPlacementIssues', () => {
    beforeEach(() => {
        setupTestDb();
    });

    it('flags REIT in TAXABLE account as misplaced', () => {
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'FIDELITY', 'TAXABLE')").run();
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc2', 'FIDELITY', 'ROTH')").run();
        db.prepare("INSERT INTO holdings (account_id, ticker, quantity, asset_type, market_value) VALUES ('acc1', 'FSRNX', 100, 'EQUITY', 5000)").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type) VALUES ('FSRNX', 'REIT', '{\"REIT\":1.0}', 'ETF')").run();

        const issues = getTaxPlacementIssues();
        const reitIssue = issues.find(i => i.ticker === 'FSRNX');
        
        expect(reitIssue).toBeDefined();
        expect(reitIssue?.currentAccountType).toBe('TAXABLE');
        expect(reitIssue?.type).toBe('LEAKAGE');
    });

    it('does not flag VTI in TAXABLE as misplaced — it belongs there', () => {
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'FIDELITY', 'TAXABLE')").run();
        db.prepare("INSERT INTO holdings (account_id, ticker, quantity, asset_type, market_value) VALUES ('acc1', 'VTI', 100, 'EQUITY', 5000)").run();
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type) VALUES ('VTI', 'Total Stock', '{\"Total Stock Market\":1.0}', 'ETF')").run();

        const issues = getTaxPlacementIssues();
        const vtiIssue = issues.find(i => i.ticker === 'VTI');
        expect(vtiIssue).toBeUndefined();
    });

    it('returns empty array when no holdings', () => {
        const issues = getTaxPlacementIssues();
        expect(issues).toEqual([]);
    });
});
