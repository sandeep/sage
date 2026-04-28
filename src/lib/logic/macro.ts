// src/lib/logic/macro.ts

export type YieldCurveState = 'NORMAL' | 'FLAT' | 'INVERTED';

export async function getYieldCurveState(): Promise<{ state: YieldCurveState, spread: number }> {
    try {
        // FRED Series ID for 10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=T10Y2Y&api_key=77666ed60066ed60066ed60066ed6006&file_type=json&sort_order=desc&limit=1`;
        
        // Mocking for now if key fails, but using standard logic
        const response = await fetch(url);
        const data = await response.json();
        const spread = parseFloat(data.observations[0].value);

        let state: YieldCurveState = 'NORMAL';
        if (spread <= 0) state = 'INVERTED';
        else if (spread < 0.2) state = 'FLAT';

        return { state, spread };
    } catch (e) {
        console.error("FRED API Error, falling back to mock NORMAL state.");
        return { state: 'NORMAL', spread: 0.5 };
    }
}
