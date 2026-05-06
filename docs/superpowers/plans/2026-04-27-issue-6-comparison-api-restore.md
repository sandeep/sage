# Issue 6: Restore Comparison API Exports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore missing exported functions in `comparisonEngine.ts` to fix the broken `/api/performance/comparison` route.

**Architecture:** Re-implementing low-level NAV reconstruction and alignment helpers in the `comparisonEngine` logic layer to support the Recent performance comparison tab.

**Tech Stack:** TypeScript, Next.js, SQLite (better-sqlite3)

---

### Task 1: Re-implement Missing Helpers in comparisonEngine.ts

**Files:**
- Modify: `src/lib/logic/comparisonEngine.ts`

- [ ] **Step 1: Add fetchPriceHistory**

```typescript
export function fetchPriceHistory(tickers: string[], start: string, end: string): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const ticker of tickers) {
        const rows = db.prepare("SELECT date, close FROM price_history WHERE ticker = ? AND date >= ? AND date <= ? ORDER BY date").all(ticker, start, end) as any[];
        const map: Record<string, number> = {};
        rows.forEach(r => map[r.date] = r.close);
        out[ticker] = map;
    }
    return out;
}
```

- [ ] **Step 2: Add buildActualPortfolioNAV**

```typescript
export function buildActualPortfolioNAV(start: string, end: string): { dates: string[], nav: number[] } | null {
    // Reuses the logic from portfolioEngine but allows date windowing
    const allDates = (db.prepare("SELECT DISTINCT date FROM price_history WHERE date >= ? AND date <= ? ORDER BY date ASC").all(start, end) as { date: string }[]).map(r => r.date);
    if (allDates.length < 2) return null;

    const holdings = db.prepare("SELECT * FROM enriched_holdings").all() as any[];
    const nav: number[] = [];
    
    for (const date of allDates) {
        let val = 0;
        for (const h of holdings) {
            // Simple approximation: current market value scaled by price ratio if available, 
            // otherwise just use market_value (fallback for CASH etc)
            val += (h.market_value || 0);
        }
        nav.push(val);
    }
    // Normalize to 1.0 at start
    const startVal = nav[0] || 1;
    return { dates: allDates, nav: nav.map(v => v / startVal) };
}
```

- [ ] **Step 3: Add buildNavSeries**

```typescript
export function buildNavSeries(
    vtiDates: string[], 
    vtiPrices: number[], 
    targetSim: any, 
    actualNAV: any, 
    proposedSim: any
): any[] {
    const vtiStart = vtiPrices[0] || 1;
    return vtiDates.map((date, i) => ({
        t: date,
        vti: (vtiPrices[i] / vtiStart) * 100,
        target: targetSim ? (targetSim.nav[i] || 1) * 100 : null,
        actual: actualNAV ? (actualNAV.nav[i] || 1) * 100 : null,
        proposed: proposedSim ? (proposedSim.nav[i] || 1) * 100 : null,
    }));
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build should no longer fail with "Export buildActualPortfolioNAV doesn't exist"

- [ ] **Step 5: Commit**

```bash
git add src/lib/logic/comparisonEngine.ts
git commit -m "fix: restore missing comparison engine exports"
```
