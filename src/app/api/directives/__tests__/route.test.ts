import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db/client';
import { setupTestDb } from '@/lib/db/__tests__/setup';
import { POST } from '../route';

function makeRequest(body: object) {
    return new Request('http://localhost/api/directives', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('POST /api/directives', () => {
    beforeEach(() => {
        setupTestDb();
        db.prepare("INSERT INTO directives (id, type, description, priority, status, reasoning, link_key) VALUES (1, 'BUY', 'Buy VTI', 'HIGH', 'PENDING', 'test', 'VTI')").run();
    });

    it('accepts SCHEDULED status with a date', async () => {
        const req = makeRequest({ id: 1, status: 'SCHEDULED', scheduled_date: '2026-04-11' });
        const res = await POST(req as any);
        const body = await res.json();
        expect(body.success).toBe(true);

        const row = db.prepare("SELECT status, scheduled_date FROM directives WHERE id = 1").get() as any;
        expect(row.status).toBe('SCHEDULED');
        expect(row.scheduled_date).toBe('2026-04-11');
    });

    it('rejects SCHEDULED without a date', async () => {
        const req = makeRequest({ id: 1, status: 'SCHEDULED' });
        const res = await POST(req as any);
        expect(res.status).toBe(400);
    });

    it('accepts EXECUTED and sets executed_at', async () => {
        const req = makeRequest({ id: 1, status: 'EXECUTED' });
        const res = await POST(req as any);
        const body = await res.json();
        expect(body.success).toBe(true);

        const row = db.prepare("SELECT status, executed_at FROM directives WHERE id = 1").get() as any;
        expect(row.status).toBe('EXECUTED');
        expect(row.executed_at).toBeTruthy();
    });
});
