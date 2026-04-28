import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../db/client';
import { setupTestDb } from '../../db/__tests__/setup';

describe('schema columns', () => {
    beforeEach(() => { setupTestDb(); });

    it('directives has account_id and tranche columns', () => {
        const cols = (db.prepare('PRAGMA table_info(directives)').all() as any[]).map(c => c.name);
        expect(cols).toContain('account_id');
        expect(cols).toContain('asset_class');
        expect(cols).toContain('scheduled_date');
        expect(cols).toContain('tranche_index');
        expect(cols).toContain('tranche_total');
        expect(cols).toContain('amount');
    });

    it('account_instrument_allowlist table exists', () => {
        const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map(t => t.name);
        expect(tables).toContain('account_instrument_allowlist');
    });
});
