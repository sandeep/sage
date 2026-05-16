# No Silent Fallbacks Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace all silent fallback patterns (phantom `|| 0`, `|| 1`, `|| accounts[0]`, hardcoded defaults) with explicit error states so broken input data surfaces as visible errors rather than plausible-but-wrong output.

**Architecture:** Introduce a shared `DataError` sentinel type. Logic functions return `null` or throw when data is genuinely absent rather than substituting a zero/one that silences the problem. UI components receive explicit "no data" props and render a clear error/empty state instead of a fabricated value. The concentration risk widget is also fixed to filter ETF/fund tickers from direct results so it only surfaces underlying single-stock exposure.

**Tech Stack:** Next.js 15, TypeScript, better-sqlite3, Tailwind CSS, vitest.

---

## Chunk 1: Error Types & xray.ts Fixes

### Task 1: Define DataError sentinel and fix resolveValue

**Files:**
- Create: `src/lib/types/errors.ts`
- Modify: `src/lib/logic/xray.ts`
- Modify: `src/lib/logic/__tests__/xray_hierarchy.test.ts`

**Context:** `resolveValue` currently returns `(quantity || 0) * price` when price exists but quantity is falsy — producing a silent `$0` instead of `null`. Callers use `|| 0` to coerce the result, propagating the problem. Fix: return `null` for any unresolvable value.

- [x] **Step 1: Write failing tests for resolveValue null behavior**

In `src/lib/logic/__tests__/xray_hierarchy.test.ts`, add:
```typescript
describe('resolveValue null propagation', () => {
    it('returns null when quantity is 0 and market_value is null', () => {
        // resolveValue is not exported — test via calculateHierarchicalMetrics
        // with a mock holding of quantity=0, market_value=null
        // expect that ticker does NOT appear in totals (value is null, not 0)
    });
});
```
> Note: if `resolveValue` is not exported, export it for testing, or test via its callers.

Run: `npx vitest run src/lib/logic/__tests__/xray_hierarchy.test.ts`
Expected: FAIL

- [x] **Step 2: Create `src/lib/types/errors.ts`**

```typescript
// src/lib/types/errors.ts

/** Returned by logic functions when required data is absent. */
export const NO_DATA = Symbol('NO_DATA');
export type NoData = typeof NO_DATA;

/** Wraps a value that may be absent due to missing data. */
export type DataResult<T> = T | null;
```

- [x] **Step 3: Fix resolveValue in xray.ts**

Find:
```typescript
    if (marketValue !== null && marketValue > 0) return marketValue;
    const price = getLatestPrice(ticker);
    if (price !== null) return (quantity || 0) * price;
    return null;
```
Replace with:
```typescript
    if (marketValue !== null && marketValue > 0) return marketValue;
    const price = getLatestPrice(ticker);
    if (price !== null) {
        if (quantity === null || quantity === undefined) return null;
        return quantity * price;
    }
    return null;
```

- [x] **Step 4: Fix `|| 0` coercions on resolveValue call sites in xray.ts**

Find (line ~116):
```typescript
value: resolveValue(ah.ticker, ah.quantity, ah.market_value) || 0
```
Replace with:
```typescript
value: resolveValue(ah.ticker, ah.quantity, ah.market_value) ?? null
```
> The UI rendering this value should display `—` when null (handled in Task 4).

- [x] **Step 5: Run tests and verify pass**

Run: `npx vitest run src/lib/logic/__tests__/xray_hierarchy.test.ts`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add src/lib/types/errors.ts src/lib/logic/xray.ts src/lib/logic/__tests__/xray_hierarchy.test.ts
git commit -m "fix: resolveValue returns null for missing quantity instead of coercing to 0"
```

---

### Task 2: Fix `|| 1` portfolio total guards in xray.ts

**Files:**
- Modify: `src/lib/logic/xray.ts`

**Context:** Three `reduce(...) || 1` guards (lines 77, 104, 258) make an empty portfolio look like a portfolio worth `$1`. Downstream percentage calculations all return plausible `0%` values instead of propagating a "no data" state. Fix: return an explicit empty result when `totalPortfolioValue === 0`.

- [x] **Step 1: Write failing test for empty portfolio**

In `src/lib/logic/__tests__/xray_hierarchy.test.ts`, add:
```typescript
it('returns empty array when no holdings exist', () => {
    // Use an in-memory DB with empty holdings table
    const result = calculateHierarchicalMetrics();
    expect(result).toEqual([]);
});
```
Run: `npx vitest run src/lib/logic/__tests__/xray_hierarchy.test.ts`
Expected: FAIL (currently returns rows with 0% values)

- [x] **Step 2: Fix calculateHierarchicalMetrics early return**

Find (line ~77):
```typescript
const totalPortfolioValue = Object.values(tickerValues).reduce((acc, v) => acc + v, 0) || 1;
```
Replace with:
```typescript
const totalPortfolioValue = Object.values(tickerValues).reduce((acc, v) => acc + v, 0);
if (totalPortfolioValue === 0) return [];
```

- [x] **Step 3: Fix contributor denominator guard (line ~104)**

Find:
```typescript
const grand = Object.values(totals).reduce((s, v) => s + v, 0) || 1;
```
Replace with:
```typescript
const grand = Object.values(totals).reduce((s, v) => s + v, 0);
if (grand === 0) return [];
```

- [x] **Step 4: Fix getConcentrationRisks guard (line ~258)**

Find:
```typescript
const totalPortfolioValue = Object.values(tickerValues).reduce((acc, v) => acc + v, 0) || 1;
```
Replace with:
```typescript
const totalPortfolioValue = Object.values(tickerValues).reduce((acc, v) => acc + v, 0);
if (totalPortfolioValue === 0) return [];
```

- [x] **Step 5: Run tests**

Run: `npx vitest run src/lib/logic/__tests__/xray_hierarchy.test.ts`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add src/lib/logic/xray.ts src/lib/logic/__tests__/xray_hierarchy.test.ts
git commit -m "fix: xray returns empty array on zero portfolio value instead of || 1 guard"
```

---

## Chunk 2: Concentration Risk — Filter Funds, Surface Missing Data

### Task 3: Fix getConcentrationRisks to exclude ETF/fund tickers

**Files:**
- Modify: `src/lib/logic/xray.ts`
- Modify: `src/lib/logic/__tests__/xray_hierarchy.test.ts`

**Context:** `getConcentrationRisks` currently shows FZROX, VTI, and other broad index funds as "concentration risks" because `etf_composition` is empty — so ETF look-through yields nothing and the fund itself appears as a direct holding. The intent is to surface underlying single stocks you are overexposed to. Fix: exclude any ticker whose `asset_registry.asset_type` is `'ETF'` or `'FUND'` from the **direct** bucket. Also surface a warning when etf_composition has no data for held ETFs (so the user knows look-through is unavailable).

- [x] **Step 1: Write failing test**

In `src/lib/logic/__tests__/xray_hierarchy.test.ts`, add:
```typescript
it('excludes ETF tickers from direct concentration results', () => {
    // seed asset_registry with FZROX asset_type='ETF'
    // seed holdings with only FZROX
    // expect getConcentrationRisks() to return []
    // (no underlying composition data, no individual stock risk to surface)
});
```
Run: `npx vitest run`
Expected: FAIL

- [x] **Step 2: Load asset_type from asset_registry in getConcentrationRisks**

Find the start of `getConcentrationRisks`:
```typescript
export function getConcentrationRisks(): ...{
    const holdings = db.prepare(`
        SELECT ticker, SUM(quantity) as quantity, SUM(market_value) as market_value
        FROM holdings GROUP BY ticker
    `).all() as ...
```
Replace with:
```typescript
export function getConcentrationRisks(): Array<{ ticker: string; name: string; percentage: number; value: number; rationale: string; isFundLookthrough: boolean }> {
    const holdings = db.prepare(`
        SELECT h.ticker, SUM(h.quantity) as quantity, SUM(h.market_value) as market_value,
               ar.asset_type
        FROM holdings h
        LEFT JOIN asset_registry ar ON h.ticker = ar.ticker
        GROUP BY h.ticker
    `).all() as { ticker: string; quantity: number; market_value: number | null; asset_type: string | null }[];
```

- [x] **Step 3: Skip fund tickers in direct exposure bucket**

Find:
```typescript
        // 1. Direct exposure
        if (!aggregateExposure[h.ticker]) aggregateExposure[h.ticker] = { direct: 0, indirect: 0 };
        aggregateExposure[h.ticker].direct += value;
```
Replace with:
```typescript
        const isFund = h.asset_type === 'ETF' || h.asset_type === 'FUND' || h.asset_type === 'MUTUAL_FUND';

        // 1. Direct exposure — only for individual equities, not funds
        if (!isFund) {
            if (!aggregateExposure[h.ticker]) aggregateExposure[h.ticker] = { direct: 0, indirect: 0 };
            aggregateExposure[h.ticker].direct += value;
        }
```

- [x] **Step 4: Update the return type to include isFundLookthrough flag**

Find:
```typescript
            return { ticker, name, percentage, value: total, rationale };
```
Replace with:
```typescript
            return { ticker, name, percentage, value: total, rationale, isFundLookthrough: data.direct === 0 && data.indirect > 0 };
```

- [x] **Step 5: Run tests**

Run: `npx vitest run`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add src/lib/logic/xray.ts src/lib/logic/__tests__/xray_hierarchy.test.ts
git commit -m "fix: concentration risk excludes ETF/fund tickers from direct exposure; only surfaces individual stock look-through"
```

---

### Task 4: Surface ETF look-through unavailability in RiskWidget

**Files:**
- Modify: `src/app/components/RiskWidget.tsx`
- Modify: `src/app/page.tsx` (or wherever RiskWidget is called — check the caller)

**Context:** When `etf_composition` is empty, `getConcentrationRisks` returns `[]` after Task 3. The RiskWidget should not just say "No single-stock concentrations >5%" — it should say "ETF composition data unavailable — look-through not possible." This distinguishes "portfolio is clean" from "we don't have the data to check."

- [x] **Step 1: Add `hasEtfHoldings` prop to RiskWidget**

In `src/app/components/RiskWidget.tsx`, update the props interface:
```typescript
export default function RiskWidget({ risks, expenseRisks, hasEtfHoldings }: {
    risks: Risk[];
    expenseRisks: ExpenseRisk[];
    hasEtfHoldings: boolean;
}) {
```

- [x] **Step 2: Update the empty state message**

Find:
```typescript
                        <div className="text-[11px] text-zinc-600 italic">No single-stock concentrations &gt;5%.</div>
```
Replace with:
```typescript
                        {hasEtfHoldings ? (
                            <div className="text-[11px] text-amber-700 italic">ETF look-through data unavailable. Seed <code>etf_composition</code> to surface underlying stock exposure.</div>
                        ) : (
                            <div className="text-[11px] text-zinc-600 italic">No single-stock concentrations &gt;5%.</div>
                        )}
```

- [x] **Step 3: Compute hasEtfHoldings in the page that renders RiskWidget**

Find the page that calls `RiskWidget` and passes `risks`. Add:
```typescript
// Check if any held tickers are ETFs/funds with no composition data
const heldFunds = db.prepare(`
    SELECT COUNT(*) as n FROM holdings h
    JOIN asset_registry ar ON h.ticker = ar.ticker
    WHERE ar.asset_type IN ('ETF', 'FUND', 'MUTUAL_FUND')
`).get() as { n: number };

const hasEtfComposition = db.prepare(`SELECT COUNT(*) as n FROM etf_composition`).get() as { n: number };
const hasEtfHoldings = heldFunds.n > 0 && hasEtfComposition.n === 0;
```
Pass `hasEtfHoldings` to `<RiskWidget />`.

- [x] **Step 4: Verify visually**

Start the app: `npm run dev`
Navigate to the dashboard. Confirm RiskWidget shows the amber warning when `etf_composition` is empty.

- [x] **Step 5: Commit**

```bash
git add src/app/components/RiskWidget.tsx src/app/page.tsx
git commit -m "feat: RiskWidget shows ETF look-through unavailable warning when etf_composition is empty"
```

---

## Chunk 3: Rebalancer Silent Fallbacks

### Task 5: Fix portfolioValue guard and account selection fallbacks

**Files:**
- Modify: `src/lib/logic/rebalancer.ts`

**Context:** Three fallbacks produce misleading directives:
1. `portfolioValue || 1` — generates `$0.0k` directives when DB is empty
2. `|| accounts[0]` on SELL venue — targets wrong tax wrapper silently
3. `|| accounts[0]` on BUY venue — same problem
4. `|| allowed[0]` — picks arbitrary ticker when none maps to category

- [x] **Step 1: Fix portfolioValue guard**

Find:
```typescript
    }, 0) || 1;
```
(the portfolioValue reduction)

Replace with:
```typescript
    }, 0);
    if (portfolioValue === 0) {
        console.warn('rebalancer: portfolioValue is 0 — no priced holdings. Skipping directive generation.');
        return 0;
    }
```

- [x] **Step 2: Fix SELL venue fallback**

Find:
```typescript
        const sellCandidate = accounts.find(acc => acc.tax_character === 'TAXABLE') || accounts[0];
```
Replace with:
```typescript
        const sellCandidate = accounts.find(acc => acc.tax_character === 'TAXABLE');
        if (!sellCandidate) {
            console.warn(`rebalancer: no TAXABLE account found for SELL directive on ${m.label} — skipping`);
            return;
        }
```

- [x] **Step 3: Fix BUY venue fallback**

Find:
```typescript
        }) || accounts[0];
```
Replace with:
```typescript
        });
        if (!buyVenue) {
            console.warn(`rebalancer: no matching account found for BUY directive on ${m.label} (target: ${targetTaxCharacter}) — skipping`);
            return;
        }
```
> Remove the trailing `|| accounts[0]` and update the `const buyVenue` declaration to `let buyVenue`.

- [x] **Step 4: Fix allowed ticker fallback**

Find:
```typescript
            bestBuy = allowed.find(t => (tickerMap[t]?.weights[m.label] || 0) > 0.5) || allowed[0] || m.label;
```
Replace with:
```typescript
            const matchedTicker = allowed.find(t => (tickerMap[t]?.weights[m.label] || 0) > 0.5);
            if (!matchedTicker) {
                console.warn(`rebalancer: no allowed ticker maps to category ${m.label} in account ${buyVenue.id} — skipping BUY`);
                return;
            }
            bestBuy = matchedTicker;
```

- [x] **Step 5: Verify the app still generates directives with a real portfolio**

Start the app: `npm run dev`
Navigate to dashboard, trigger a rebalance. Confirm directives still appear with real account names and tickers.

- [x] **Step 6: Commit**

```bash
git add src/lib/logic/rebalancer.ts
git commit -m "fix: rebalancer skips directive generation when portfolio is empty or no account matches tax character"
```

---

## Chunk 4: portfolioEngine, refresh, and UI Error States

### Task 6: Fix portfolioEngine NAV dilution and VTI pre-fetch zeros

**Files:**
- Modify: `src/lib/logic/portfolioEngine.ts`

**Context:**
1. `|| 0` on line ~109 — unpriced tickers add `0` to NAV, silently deflating it
2. `?? 0` on line ~173 — pre-fetch VTI NAV is zeros, distorting Beta toward zero on fresh install

- [x] **Step 1: Fix unpriced ticker NAV dilution**

Find (line ~109):
```typescript
nav += marketValueFallback.get(h.ticker) || 0;
```
Replace with:
```typescript
const mv = marketValueFallback.get(h.ticker);
if (mv === undefined || mv === null) {
    // Skip unpriced tickers — don't dilute NAV with a phantom zero
    continue;
}
nav += mv;
```

- [x] **Step 2: Fix VTI pre-fetch zeros in Beta calculation**

Find (line ~173):
```typescript
vtiNAV.push(lastVti ?? 0);
```
Replace with:
```typescript
if (lastVti === null || lastVti === undefined) continue; // skip dates with no VTI price
vtiNAV.push(lastVti);
```
> Also skip the corresponding portfolio NAV entry for that date to keep arrays aligned. Adjust the loop to push both or neither.

- [x] **Step 3: Verify audit page still loads**

Run: `npm run dev`
Navigate to `/audit`. Confirm metrics render (may change values slightly — that's expected and correct).

- [x] **Step 4: Commit**

```bash
git add src/lib/logic/portfolioEngine.ts
git commit -m "fix: portfolioEngine skips unpriced tickers in NAV; drops VTI zero-days from Beta calculation"
```

---

### Task 7: Fix refresh.ts silent failures

**Files:**
- Modify: `src/lib/data/refresh.ts`

**Context:**
1. `|| '2024-01-01'` hardcoded — silent stale start date for new tickers
2. `if (!res.ok) return` in `fetchMetaBatch` — failed batches not tracked
3. `catch { /* ER not available */ }` — network errors identical to "no ER data"

- [x] **Step 1: Replace hardcoded history epoch with a constant**

Find:
```typescript
        const from = last.d || '2024-01-01';
```
Replace with:
```typescript
        const HISTORY_START = '2020-01-01'; // earliest date for price history; update as needed
        const from = last.d || HISTORY_START;
```
Move the constant to the top of the file near `BATCH_SIZE`.

- [x] **Step 2: Track failed batches in fetchMetaBatch**

Change the signature to return a failed list:
```typescript
async function fetchMetaBatch(tickers: string[]): Promise<string[]> {
    try {
        ...
        if (!res.ok) {
            console.warn(`fetchMetaBatch: HTTP ${res.status} for symbols ${tickers.join(',')}`);
            return tickers; // all tickers in batch failed
        }
        ...
        return []; // no failures
    } catch (e) {
        console.error(`Batch fetch failed:`, e);
        return tickers;
    }
}
```

Update the caller in `runRefresh` to collect failures:
```typescript
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
        const batch = tickers.slice(i, i + BATCH_SIZE);
        const failed = await fetchMetaBatch(batch);
        result.failed.push(...failed);
        if (i + BATCH_SIZE < tickers.length) await sleep(BATCH_DELAY_MS);
    }
```

- [x] **Step 3: Distinguish ER unavailability from fetch errors**

Find:
```typescript
            } catch { /* ER not available */ }
```
Replace with:
```typescript
            } catch (e: any) {
                // ER fetch failed (network/rate-limit) — not the same as "no ER data"
                console.warn(`ER fetch failed for ${ticker}: ${e?.message}`);
                // er stays null, which is correct — just log it
            }
```

- [x] **Step 4: Commit**

```bash
git add src/lib/data/refresh.ts
git commit -m "fix: refresh.ts logs failed meta batches and distinguishes ER errors from unavailable data"
```

---

### Task 8: Fix UI hardcoded fallback in audit/page.tsx

**Files:**
- Modify: `src/app/audit/page.tsx`

**Context:**
1. `|| 1` on `tv` makes fee BPS render a real-looking number when portfolio value is zero
2. Hardcoded `14.2` for `currentRisk` — frontier chart plots fabricated risk when no price history

- [x] **Step 1: Fix fee BPS division guard**

Find:
```typescript
        const tv = perf.totalPortfolioValue || 1;
        const feeOpportunityBps = expenseRisks.reduce((sum, r) => sum + (r.potentialSavings / tv) * 10000, 0);
```
Replace with:
```typescript
        const tv = perf.totalPortfolioValue;
        const feeOpportunityBps = tv > 0
            ? expenseRisks.reduce((sum, r) => sum + (r.potentialSavings / tv) * 10000, 0)
            : null;
```
Update the render site to show `—` when `feeOpportunityBps === null`.

- [x] **Step 2: Fix hardcoded risk fallback**

Find:
```typescript
        const currentRisk   = perf.annualizedVol !== null ? perf.annualizedVol * 100 : 14.2;
        const currentReturn = perf.return1y      !== null ? perf.return1y * 100      : 0;
```
Replace with:
```typescript
        const currentRisk   = perf.annualizedVol !== null ? perf.annualizedVol * 100 : null;
        const currentReturn = perf.return1y      !== null ? perf.return1y * 100      : null;
```
Pass these to `PerformanceFrontier`. If both are `null`, render a message: "Insufficient price history to plot frontier." instead of the chart.

- [x] **Step 3: Update PerformanceFrontier to handle null risk/return**

In `src/app/components/PerformanceFrontier.tsx`, add a null guard at the top:
```typescript
if (currentRisk === null || currentReturn === null) {
    return (
        <div className="text-[11px] text-zinc-600 italic text-center py-8">
            Insufficient price history — run a data refresh to plot the frontier.
        </div>
    );
}
```

- [x] **Step 4: Commit**

```bash
git add src/app/audit/page.tsx src/app/components/PerformanceFrontier.tsx
git commit -m "fix: audit page shows — and error states instead of fabricated values when data is missing"
```

---

### Task 9: Fix MetricTable and AccountMapper fallbacks

**Files:**
- Modify: `src/app/components/MetricTable.tsx`
- Modify: `src/app/components/AccountMapper.tsx`

**Context:**
1. `MetricTable.tsx:21` — `|| 1` on `totalValue` makes all dollar values nonsensical when `Total Portfolio` row is absent
2. `AccountMapper.tsx:100` — `|| ACCOUNT_CONFIGS[2]` silently shows unrecognized accounts as "Taxable Brokerage"

- [x] **Step 1: Fix MetricTable total row guard**

Find:
```typescript
    const totalValue = totalRow?.actualValue || 1;
```
Replace with:
```typescript
    const totalValue = totalRow?.actualValue ?? 0;
    if (totalValue === 0) {
        return (
            <div className="text-[11px] text-zinc-600 italic text-center py-8">
                No portfolio data. Import holdings to begin.
            </div>
        );
    }
```

- [x] **Step 2: Fix AccountMapper unknown account type**

Find:
```typescript
                        const currentConfig = ACCOUNT_CONFIGS.find(c => c.type === acc.account_type || (!acc.account_type && c.character === acc.tax_character)) || ACCOUNT_CONFIGS[2];
```
Replace with:
```typescript
                        const currentConfig = ACCOUNT_CONFIGS.find(c => c.type === acc.account_type || (!acc.account_type && c.character === acc.tax_character));
                        if (!currentConfig) {
                            // Unrecognized account type — render a visible warning row instead of silently defaulting
                            return (
                                <div key={acc.id} className="px-6 py-4 border-b border-zinc-900 text-[10px] text-amber-700">
                                    Unknown account type for {acc.id} (type: {acc.account_type ?? 'null'}, character: {acc.tax_character}) — update account configuration.
                                </div>
                            );
                        }
```

- [x] **Step 3: Verify accounts page renders correctly**

Start the app: `npm run dev`
Navigate to `/accounts`. Confirm all accounts render correctly. If any show the amber warning, fix the underlying account data.

- [x] **Step 4: Commit**

```bash
git add src/app/components/MetricTable.tsx src/app/components/AccountMapper.tsx
git commit -m "fix: MetricTable and AccountMapper show explicit error states instead of silent defaults"
```
