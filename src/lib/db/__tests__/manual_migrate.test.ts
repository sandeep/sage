import { describe, it } from 'vitest';
import { getDb } from '@/lib/db/client';

describe('Manual Migration', () => {
    it('should run migrations', () => {
        getDb();
        console.log('✅ Migrations executed via Vitest.');
    });
});
