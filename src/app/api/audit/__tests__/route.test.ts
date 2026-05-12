import { GET } from '../route';
import { describe, expect, it, vi } from 'vitest';
import * as auditService from '@/lib/logic/auditService';

vi.mock('@/lib/logic/auditService', () => ({
    getAuditTrail: vi.fn(),
}));

describe('GET /api/audit', () => {
    it('returns 400 if id is missing', async () => {
        const req = new Request('http://localhost/api/audit');
        const res = await GET(req);
        
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toEqual({ error: 'Missing id' });
    });

    it('returns audit trail data for valid id', async () => {
        const mockData = [
            { date: '2023-01-01', market_value: 100 },
            { date: '2022-12-01', market_value: 90 },
        ];
        vi.mocked(auditService.getAuditTrail).mockReturnValue(mockData);

        const req = new Request('http://localhost/api/audit?id=AAPL');
        const res = await GET(req);
        
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual(mockData);
        expect(auditService.getAuditTrail).toHaveBeenCalledWith('AAPL');
    });
});
