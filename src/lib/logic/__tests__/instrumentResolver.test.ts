import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';
import { resolveInstrument } from '../instrumentResolver';

describe('resolveInstrument', () => {
    beforeEach(() => {
        setupTestDb();
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-v', 'VANGUARD', 'DEFERRED')").run();
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-f', 'FIDELITY', 'ROTH')").run();
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-s', 'SCHWAB', 'TAXABLE')").run();
    });

    it('Tier D: returns already-held ticker when account holds it', () => {
        db.prepare("INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) VALUES ('VIIIX', 'Vanguard Institutional', '{\"Total Stock Market\":1.0}', 'FUND', 1)").run();
        db.prepare("INSERT INTO holdings_ledger (snapshot_date, account_id, ticker, quantity, asset_type) VALUES ('2026-01-01', 'acc-v', 'VIIIX', 100, 'FUND')").run();

        const result = resolveInstrument('acc-v', 'Total Stock Market');
        expect(result.ticker).toBe('VIIIX');
        expect(result.tier).toBe('D');
        expect(result.subtitle).toContain('already in this account');
    });

    it('Tier C: returns allowlist ticker when no holding but allowlist entry exists', () => {
        db.prepare("INSERT INTO account_instrument_allowlist (account_id, ticker, asset_class) VALUES ('acc-f', 'FZROX', 'Total Stock Market')").run();

        const result = resolveInstrument('acc-f', 'Total Stock Market');
        expect(result.ticker).toBe('FZROX');
        expect(result.tier).toBe('C');
        expect(result.subtitle).toContain('on your list');
    });

    it('Tier B: returns provider-matched ticker for Vanguard account with no holding', () => {
        const result = resolveInstrument('acc-v', 'Total Stock Market');
        expect(result.ticker).toBe('VIIIX');
        expect(result.tier).toBe('B');
        expect(result.subtitle).toContain('Vanguard');
    });

    it('Tier B: returns provider-matched ticker for Fidelity', () => {
        const result = resolveInstrument('acc-f', 'Total Stock Market');
        expect(result.ticker).toBe('FZROX');
        expect(result.tier).toBe('B');
    });

    it('Tier DEFAULT: returns DEFAULT_MAP ticker when no provider match', () => {
        db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc-u', 'UNKNOWN', 'TAXABLE')").run();
        const result = resolveInstrument('acc-u', 'Total Stock Market');
        expect(result.ticker).toBeTruthy();
        expect(result.tier).toBe('DEFAULT');
        expect(result.subtitle).toContain('best available');
    });

    it('falls back gracefully when assetClass is unknown', () => {
        const result = resolveInstrument('acc-v', 'Unicorn Asset');
        expect(result.ticker).toBe('Unicorn Asset');
        expect(result.tier).toBe('DEFAULT');
    });
});
