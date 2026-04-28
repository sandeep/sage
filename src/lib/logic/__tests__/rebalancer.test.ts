
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateDirectives } from '../rebalancer';
import db from '../../db/client';
import { setupTestDb } from '../../../lib/db/__tests__/setup';

describe('rebalancer', () => {
    beforeEach(() => {
        setupTestDb();
    });

    it.skip('generates rebalance directive when account has idle cash', async () => {
        // ... rest of test
    });
});
