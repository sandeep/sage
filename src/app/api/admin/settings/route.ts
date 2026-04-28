
import { getStrategicSettings, updateStrategicSetting, StrategicSettings } from '@/lib/db/settings';

export async function GET() {
    return Response.json(getStrategicSettings());
}

export async function PUT(req: Request) {
    const body = await req.json() as Partial<StrategicSettings>;
    
    if (body.ordinary_tax_rate !== undefined) updateStrategicSetting('ordinary_tax_rate', body.ordinary_tax_rate);
    if (body.dividend_tax_rate !== undefined) updateStrategicSetting('dividend_tax_rate', body.dividend_tax_rate);
    if (body.risk_free_rate !== undefined) updateStrategicSetting('risk_free_rate', body.risk_free_rate);

    return Response.json({ ok: true });
}
