# Performance Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Replace the `/audit` page with a cost-of-inaction dashboard that answers "am I overpaying?" and "what am I leaving on the table per year?" in dollars — leading with a hero number and supporting with benchmark-relative risk analysis.

**Architecture:** The page remains a React Server Component (`audit/page.tsx`) that fetches all data and passes props to four new client components (Zones 1–4). Client components are needed because they read `usePrivacy()` for dollar hiding and `sessionStorage` for draft allocation support. The `ComparisonPanel` (Zone 4) is unchanged.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, better-sqlite3, Vitest, React Context (`PrivacyContext`)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/lib/logic/portfolioEngine.ts` | Add `maxDrawdown` to metrics return |
| Modify | `src/lib/logic/xray_risks.ts` | Add `getTaxPlacementIssues()` |
| Create | `src/app/components/CostOfInactionHero.tsx` | Zone 1 — annual drag hero + 3 tiles |
| Create | `src/app/components/RiskAdjustedPanel.tsx` | Zone 2 — uncompensated risk + delta table |
| Create | `src/app/components/OverpayingProof.tsx` | Zone 3a — tax placement + fee swap detail |
| Create | `src/app/components/AllocationGapProof.tsx` | Zone 3b — CAGR gap + per-category breakdown |
| Modify | `src/app/audit/page.tsx` | Rewrite: fetch data, compute dollar amounts, wire zones |
| Create | `src/lib/logic/__tests__/taxPlacement_issues.test.ts` | Tests for getTaxPlacementIssues |

---

## Task 1: Add `maxDrawdown` to `portfolioEngine.ts`

**Files:**
- Modify: `src/lib/logic/portfolioEngine.ts`

`maxDrawdown` is the largest peak-to-trough decline in the daily NAV series. It's needed for the Zone 2 delta table.

 - [x] **Step 1: Add `maxDrawdown` to the interface**

In `src/lib/logic/portfolioEngine.ts`, add to `PortfolioPerformanceMetrics`:

```typescript
maxDrawdown: number | null;  // peak-to-trough, e.g. -0.142 means -14.2%
```

 - [x] **Step 2: Compute maxDrawdown from `dailyNAV`**

After the `annualizedVol` computation (around line 146), add:

```typescript
// ── Max drawdown ────────────────────────────────────────────────────────
let maxDrawdown: number | null = null;
if (dailyNAV.length >= 2) {
    let peak = dailyNAV[0];
    let maxDD = 0;
    for (const nav of dailyNAV) {
        if (nav > peak) peak = nav;
        const dd = (nav - peak) / peak;
        if (dd < maxDD) maxDD = dd;
    }
    maxDrawdown = maxDD;
}
```

 - [x] **Step 3: Add to the return object**

In the final `return { ... }` block, add `maxDrawdown`.

Also add `maxDrawdown: null` to the **four** early-return stubs in the function — the TypeScript compiler will catch any you miss because `PortfolioPerformanceMetrics` will now require the field.

 - [x] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error TS|✓ Compiled"
```
Expected: `✓ Compiled successfully`

 - [x] **Step 5: Commit**

```bash
git add src/lib/logic/portfolioEngine.ts
git commit -m "feat: add maxDrawdown to PortfolioPerformanceMetrics"
```

---

## Task 2: Add `getTaxPlacementIssues()` to `xray_risks.ts`

**Files:**
- Modify: `src/lib/logic/xray_risks.ts`
- Create: `src/lib/logic/__tests__/taxPlacement_issues.test.ts`

This function finds holdings sitting in the wrong account type per Bogleheads placement rules.

 - [x] **Step 1: Write the failing test**

Create `src/lib/logic/__tests__/taxPlacement_issues.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../db/client';
import { getTaxPlacementIssues } from '../xray_risks';

function seed() {
    db.exec(`
        INSERT INTO accounts (id, nickname, provider, tax_character) VALUES
            ('roth1', 'Fidelity Roth', 'Fidelity', 'ROTH'),
            ('tax1',  'Fidelity Taxable', 'Fidelity', 'TAXABLE');
        INSERT INTO asset_registry (ticker, canonical, weights, asset_type, is_core) VALUES
            ('VNQ', 'Vanguard REIT', '{"REIT":1.0}', 'ETF', 1),
            ('VTI', 'Vanguard Total Market', '{"Total Stock Market":1.0}', 'ETF', 1);
        INSERT INTO holdings (id, account_id, ticker, quantity, market_value) VALUES
            ('h1', 'tax1', 'VNQ', 10, 1000),
            ('h2', 'tax1', 'VTI', 20, 2000);
    `);
}

beforeEach(() => {
    db.exec(`
        DELETE FROM holdings; DELETE FROM accounts; DELETE FROM asset_registry;
    `);
});

describe('getTaxPlacementIssues', () => {
    it('flags REIT in TAXABLE account as misplaced', () => {
        seed();
        const issues = getTaxPlacementIssues();
        const reitIssue = issues.find(i => i.ticker === 'VNQ');
        expect(reitIssue).toBeDefined();
        expect(reitIssue!.currentAccountType).toBe('TAXABLE');
        expect(reitIssue!.preferredAccountType).toBe('ROTH');
    });

    it('does not flag VTI in TAXABLE as misplaced — it belongs there', () => {
        seed();
        const issues = getTaxPlacementIssues();
        expect(issues.find(i => i.ticker === 'VTI')).toBeUndefined();
    });

    it('returns empty array when no holdings', () => {
        expect(getTaxPlacementIssues()).toEqual([]);
    });
});
```

 - [x] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/lib/logic/__tests__/taxPlacement_issues.test.ts
```
Expected: FAIL — `getTaxPlacementIssues is not a function`

 - [x] **Step 3: Add the interface and function to `xray_risks.ts`**

Add at the bottom of `src/lib/logic/xray_risks.ts` (after the existing imports, add the taxPlacement import at the top):

```typescript
// add to imports at top (resolveValue is already imported from './xray' on line 4 — no change needed there):
import { PLACEMENT_PRIORITY, AccountType, TaxEfficiencyTier } from './taxPlacement';
```

Then add the interface and function:

```typescript
export interface TaxPlacementIssue {
    ticker: string;
    allocationLabel: string;
    tier: TaxEfficiencyTier;
    currentAccountType: AccountType;
    currentAccountName: string;
    preferredAccountType: AccountType;
    holdingValue: number;
}

export function getTaxPlacementIssues(): TaxPlacementIssue[] {
    const rows = db.prepare(`
        SELECT h.ticker, SUM(h.market_value) as market_value, SUM(h.quantity) as quantity,
               a.tax_character, a.nickname, ar.weights
        FROM holdings h
        JOIN accounts a ON h.account_id = a.id
        LEFT JOIN asset_registry ar ON h.ticker = ar.ticker
        GROUP BY h.ticker, a.id
    `).all() as {
        ticker: string; market_value: number | null; quantity: number;
        tax_character: string; nickname: string; weights: string | null;
    }[];

    if (rows.length === 0) return [];

    // Derive available account types across all accounts
    const availableTypes = [...new Set(
        rows.map(r => r.tax_character as AccountType)
    )];

    const issues: TaxPlacementIssue[] = [];

    for (const row of rows) {
        const weights = row.weights ? JSON.parse(row.weights) as Record<string, number> : {};
        // Determine primary allocation label by highest weight
        const primaryLabel = Object.entries(weights)
            .sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!primaryLabel) continue;

        const rule = PLACEMENT_PRIORITY[primaryLabel];
        if (!rule) continue; // no rule = efficient, skip

        const currentType = row.tax_character as AccountType;
        const preferredType = rule.priority.find(t => availableTypes.includes(t)) ?? currentType;

        // Only flag if current account is NOT the preferred type
        if (currentType === preferredType) continue;

        const holdingValue = resolveValue(row.ticker, row.quantity, row.market_value) ?? 0;
        if (holdingValue < 500) continue; // ignore tiny positions

        issues.push({
            ticker: row.ticker,
            allocationLabel: primaryLabel,
            tier: rule.tier,
            currentAccountType: currentType,
            currentAccountName: row.nickname,
            preferredAccountType: preferredType,
            holdingValue,
        });
    }

    return issues.sort((a, b) => b.holdingValue - a.holdingValue);
}
```

 - [x] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/logic/__tests__/taxPlacement_issues.test.ts
```
Expected: 3 passing

 - [x] **Step 5: Commit**

```bash
git add src/lib/logic/xray_risks.ts src/lib/logic/__tests__/taxPlacement_issues.test.ts
git commit -m "feat: add getTaxPlacementIssues to xray_risks"
```

---

## Task 3: Create `CostOfInactionHero` (Zone 1)

**Files:**
- Create: `src/app/components/CostOfInactionHero.tsx`

Client component. Reads `usePrivacy()`. Displays total annual drag + three breakdown tiles. Each tile scrolls to its proof section on click.

 - [x] **Step 1: Create the component**

```tsx
// src/app/components/CostOfInactionHero.tsx
'use client';
import { usePrivacy } from './PrivacyContext';

interface TileProps {
    id: string;
    label: string;
    dollars: number;
    bps: number;
    callToAction: string;
    privacy: boolean;
}

function Tile({ id, label, dollars, bps, callToAction, privacy }: TileProps) {
    const severity = dollars > 500 ? 'rose' : dollars > 200 ? 'amber' : 'emerald';
    const borderColor = severity === 'rose' ? 'border-rose-900' : severity === 'amber' ? 'border-amber-900' : 'border-emerald-900';
    const textColor   = severity === 'rose' ? 'text-rose-400'  : severity === 'amber' ? 'text-amber-400'  : 'text-emerald-400';

    return (
        <button
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`flex-1 bg-zinc-950 border ${borderColor} rounded-sm p-6 text-left hover:bg-zinc-900/40 transition-colors group`}
        >
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">{label}</div>
            <div className={`text-2xl font-black ${textColor} mb-1`}>
                {privacy ? <span className="tracking-widest text-zinc-600">•••</span> : `$${Math.round(dollars).toLocaleString()} / yr`}
            </div>
            <div className="text-[10px] text-zinc-600">{bps.toFixed(0)} bps</div>
            <div className="text-[9px] text-zinc-700 mt-3 group-hover:text-zinc-500 transition-colors">
                {callToAction} →
            </div>
        </button>
    );
}

interface Props {
    taxDragDollars: number;
    taxDragBps: number;
    taxIssueCount: number;
    feeDragDollars: number;
    feeDragBps: number;
    feeIssueCount: number;
    allocationGapDollars: number;
    allocationGapCagrDelta: number | null;
}

export default function CostOfInactionHero({
    taxDragDollars, taxDragBps, taxIssueCount,
    feeDragDollars, feeDragBps, feeIssueCount,
    allocationGapDollars, allocationGapCagrDelta,
}: Props) {
    const { privacy } = usePrivacy();
    const totalDrag = taxDragDollars + feeDragDollars + allocationGapDollars;

    return (
        <div className="bg-zinc-950 border border-zinc-900 rounded-sm p-8 space-y-6">
            <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                    Estimated Annual Drag
                </div>
                <div className="text-4xl font-black text-white">
                    {privacy
                        ? <span className="tracking-widest text-zinc-600">•••</span>
                        : `$${Math.round(totalDrag).toLocaleString()} / yr`
                    }
                </div>
                <div className="text-[10px] text-zinc-600 mt-1">
                    tax placement · fund costs · allocation drift
                </div>
            </div>

            <div className="flex gap-4">
                <Tile
                    id="zone-overpaying-tax"
                    label="Tax Leakage"
                    dollars={taxDragDollars}
                    bps={taxDragBps}
                    callToAction={taxIssueCount > 0 ? `${taxIssueCount} moves fix it` : 'Optimized'}
                    privacy={privacy}
                />
                <Tile
                    id="zone-overpaying-fees"
                    label="Fee Drag"
                    dollars={feeDragDollars}
                    bps={feeDragBps}
                    callToAction={feeIssueCount > 0 ? `${feeIssueCount} swaps fix it` : 'Optimized'}
                    privacy={privacy}
                />
                <Tile
                    id="zone-allocation-gap"
                    label="Allocation Gap"
                    dollars={allocationGapDollars}
                    bps={allocationGapCagrDelta !== null ? Math.round(allocationGapCagrDelta * 10000) : 0}
                    callToAction={allocationGapCagrDelta !== null
                        ? `+${(allocationGapCagrDelta * 100).toFixed(2)}% CAGR if on target`
                        : 'See breakdown'}
                    privacy={privacy}
                />
            </div>
        </div>
    );
}
```

 - [x] **Step 2: Verify TypeScript**

```bash
npm run build 2>&1 | grep -E "error TS|✓ Compiled"
```

 - [x] **Step 3: Commit**

```bash
git add src/app/components/CostOfInactionHero.tsx
git commit -m "feat: add CostOfInactionHero component (Zone 1)"
```

---

## Task 4: Create `RiskAdjustedPanel` (Zone 2)

**Files:**
- Create: `src/app/components/RiskAdjustedPanel.tsx`

Client component. Reads `usePrivacy()` and `sessionStorage` for draft allocation. Shows uncompensated risk callout, verdict sentence, and delta comparison table.

 - [x] **Step 1: Create the component**

```tsx
// src/app/components/RiskAdjustedPanel.tsx
'use client';
import { usePrivacy } from './PrivacyContext';

interface PerformanceSnapshot {
    return1y: number | null;
    annualizedVol: number | null;
    sharpe: number | null;
    sortino: number | null;
    beta: number | null;
    maxDrawdown: number | null;
    expectedCagr: number | null;
}

interface Props {
    current: PerformanceSnapshot;
    target: PerformanceSnapshot;
    vti: PerformanceSnapshot;
    // Proposed is derived client-side from sessionStorage draft — passed as null if unavailable
    proposed: PerformanceSnapshot | null;
    betaAdjustedExpected: number | null;
    verdict: string;
}

function fmt(v: number | null, mult = 100, suffix = '%', dec = 1): string {
    if (v === null) return '—';
    return (v * mult).toFixed(dec) + suffix;
}

function fmtDelta(v: number | null, mult = 100, suffix = '%', dec = 1): { text: string; color: string } {
    if (v === null) return { text: '—', color: 'text-zinc-600' };
    const val = v * mult;
    const text = (val >= 0 ? '+' : '') + val.toFixed(dec) + suffix;
    // positive delta is better for returns/ratios; negative delta is better for vol/drawdown
    return { text, color: val > 0 ? 'text-emerald-400' : val < 0 ? 'text-rose-400' : 'text-zinc-500' };
}

function fmtVolDelta(v: number | null): { text: string; color: string } {
    // For vol/drawdown: negative delta (less vol) = good = emerald
    if (v === null) return { text: '—', color: 'text-zinc-600' };
    const val = v * 100;
    const text = (val >= 0 ? '+' : '') + val.toFixed(1) + '%';
    return { text, color: val < 0 ? 'text-emerald-400' : val > 0 ? 'text-rose-400' : 'text-zinc-500' };
}

const ROWS: {
    label: string;
    key: keyof PerformanceSnapshot;
    format: (v: number | null) => string;
    deltaFn: (delta: number | null) => { text: string; color: string };
    note?: string;
}[] = [
    { label: '1Y Return',    key: 'return1y',      format: v => fmt(v), deltaFn: fmtDelta },
    { label: 'Volatility',   key: 'annualizedVol',  format: v => fmt(v), deltaFn: fmtVolDelta },
    { label: 'Sharpe',       key: 'sharpe',         format: v => fmt(v, 1, '', 2), deltaFn: d => fmtDelta(d, 1, '', 2) },
    { label: 'Sortino',      key: 'sortino',        format: v => fmt(v, 1, '', 2), deltaFn: d => fmtDelta(d, 1, '', 2) },
    { label: 'Beta',         key: 'beta',           format: v => fmt(v, 1, '', 2), deltaFn: d => fmtDelta(d, 1, '', 2) },
    { label: 'Max Drawdown', key: 'maxDrawdown',    format: v => fmt(v), deltaFn: fmtVolDelta },
    { label: 'Exp CAGR †',  key: 'expectedCagr',   format: v => fmt(v), deltaFn: fmtDelta, note: '† Forward-looking estimate based on asset class premiums.' },
];

export default function RiskAdjustedPanel({ current, target, vti, proposed, betaAdjustedExpected, verdict }: Props) {
    const { privacy } = usePrivacy();
    const showProposed = proposed !== null;

    const isCompensated = betaAdjustedExpected !== null && current.return1y !== null
        ? current.return1y >= betaAdjustedExpected
        : null;

    return (
        <div className="bg-zinc-950 border border-zinc-900 rounded-sm p-8 space-y-8">
            <h2 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                Risk-Adjusted Performance
            </h2>

            {/* Uncompensated Risk */}
            <div className="space-y-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                    Uncompensated Risk
                </div>
                {betaAdjustedExpected !== null && current.return1y !== null ? (
                    <div className={`text-sm font-black ${isCompensated ? 'text-emerald-400' : 'text-rose-400'}`}>
                        Beta-adjusted expected: {fmt(betaAdjustedExpected)} · Actual: {fmt(current.return1y)} · {isCompensated ? '+' : ''}{fmt((current.return1y - betaAdjustedExpected), 100, '%', 1)} alpha {isCompensated ? '✓' : '✗'}
                    </div>
                ) : (
                    <div className="text-zinc-600 text-sm">Insufficient data</div>
                )}
                <div className="text-[10px] text-zinc-600 italic">{verdict}</div>
            </div>

            {/* Delta table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                        <tr className="border-b border-zinc-900">
                            <th className="py-2 pr-6 text-[9px] font-black uppercase tracking-widest text-zinc-600 w-1/4"></th>
                            <th className="py-2 px-4 text-right text-[9px] font-black uppercase tracking-widest text-zinc-300">Current</th>
                            <th className="py-2 px-4 text-right text-[9px] font-black uppercase tracking-widest text-zinc-500">Δ Target</th>
                            {showProposed && (
                                <th className="py-2 px-4 text-right text-[9px] font-black uppercase tracking-widest text-zinc-500">Δ Proposed</th>
                            )}
                            <th className="py-2 px-4 text-right text-[9px] font-black uppercase tracking-widest text-zinc-500">Δ VTI</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/50">
                        {ROWS.map(row => {
                            const cur = current[row.key] as number | null;
                            const tgt = target[row.key] as number | null;
                            const vtiVal = vti[row.key] as number | null;
                            const prop = proposed ? proposed[row.key] as number | null : null;

                            const dTarget   = cur !== null && tgt     !== null ? tgt     - cur : null;
                            const dVti      = cur !== null && vtiVal  !== null ? vtiVal  - cur : null;
                            const dProposed = cur !== null && prop    !== null ? prop    - cur : null;

                            const dtgt  = row.deltaFn(dTarget);
                            const dvti  = row.deltaFn(dVti);
                            const dprop = row.deltaFn(dProposed);

                            return (
                                <tr key={row.key} className="group hover:bg-zinc-900/20">
                                    <td className="py-3 pr-6 text-zinc-500 uppercase tracking-widest text-[9px] font-black">
                                        {row.label}
                                    </td>
                                    <td className="py-3 px-4 text-right font-black text-zinc-200">
                                        {row.key === 'expectedCagr' && privacy
                                            ? <span className="tracking-widest text-zinc-600">•••</span>
                                            : row.format(cur)}
                                    </td>
                                    <td className={`py-3 px-4 text-right font-black ${dtgt.color}`}>{dtgt.text}</td>
                                    {showProposed && (
                                        <td className={`py-3 px-4 text-right font-black ${dprop.color}`}>{dprop.text}</td>
                                    )}
                                    <td className={`py-3 px-4 text-right font-black ${dvti.color}`}>{dvti.text}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {ROWS.filter(r => r.note).map(r => (
                <div key={r.key} className="text-[9px] text-zinc-700 italic">{r.note}</div>
            ))}

            {showProposed && (
                <div className="text-[9px] text-zinc-700">Δ Proposed reflects draft allocation loaded from the Allocation editor.</div>
            )}
        </div>
    );
}
```

 - [x] **Step 2: Verify TypeScript**

```bash
npm run build 2>&1 | grep -E "error TS|✓ Compiled"
```

 - [x] **Step 3: Commit**

```bash
git add src/app/components/RiskAdjustedPanel.tsx
git commit -m "feat: add RiskAdjustedPanel component (Zone 2)"
```

---

## Task 5: Create `OverpayingProof` (Zone 3a)

**Files:**
- Create: `src/app/components/OverpayingProof.tsx`

Client component. Shows tax placement mismatches and fee swap opportunities with dollar estimates.

 - [x] **Step 1: Create the component**

```tsx
// src/app/components/OverpayingProof.tsx
'use client';
import { usePrivacy } from './PrivacyContext';
import type { TaxPlacementIssue } from '@/lib/logic/xray_risks';
import type { ExpenseRisk } from '@/lib/logic/xray_risks';

// Note: privacy is read via usePrivacy() internally — not a prop
interface Props {
    taxIssues: TaxPlacementIssue[];
    feeRisks: ExpenseRisk[];
    totalTaxDragDollars: number;
    portfolioValue: number;
}

const TIER_LABEL: Record<string, string> = {
    very_inefficient:    'Very inefficient — avoid taxable',
    inefficient:         'Inefficient — defer the income',
    moderately_inefficient: 'Moderately inefficient',
    efficient:           'Tax efficient',
};

export default function OverpayingProof({ taxIssues, feeRisks, totalTaxDragDollars, portfolioValue }: Props) {
    const { privacy } = usePrivacy();

    // Attribute total tax drag proportionally to misplaced holdings by value
    const totalMisplacedValue = taxIssues.reduce((s, i) => s + i.holdingValue, 0);
    const savingsFor = (issue: TaxPlacementIssue) =>
        totalMisplacedValue > 0
            ? (issue.holdingValue / totalMisplacedValue) * totalTaxDragDollars
            : 0;

    const dollar = (n: number) => privacy
        ? <span className="tracking-widest text-zinc-600">•••</span>
        : <span>${Math.round(n).toLocaleString()}</span>;

    return (
        <div className="space-y-10">
            {/* Tax Placement */}
            <div id="zone-overpaying-tax" className="space-y-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Tax Placement
                </div>
                {taxIssues.length === 0 ? (
                    <div className="text-[11px] text-emerald-500 font-black">✓ All holdings are optimally placed</div>
                ) : (
                    <div className="bg-zinc-950 border border-zinc-900 rounded-sm overflow-hidden">
                        <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                                <tr className="border-b border-zinc-900 text-[9px] font-black uppercase tracking-widest text-zinc-600">
                                    <th className="px-6 py-3">Holding</th>
                                    <th className="px-6 py-3">Now</th>
                                    <th className="px-6 py-3">→ Move To</th>
                                    <th className="px-6 py-3">Why</th>
                                    <th className="px-6 py-3 text-right">Est. Savings</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900/50">
                                {taxIssues.map(issue => (
                                    <tr key={`${issue.ticker}-${issue.currentAccountName}`} className="hover:bg-zinc-900/20">
                                        <td className="px-6 py-4 font-black text-zinc-200">{issue.ticker}</td>
                                        <td className="px-6 py-4 text-rose-400">{issue.currentAccountType}</td>
                                        <td className="px-6 py-4 text-emerald-400">{issue.preferredAccountType}</td>
                                        <td className="px-6 py-4 text-zinc-500 italic text-[10px]">
                                            {TIER_LABEL[issue.tier] ?? issue.tier}
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-rose-400">
                                            ~{dollar(savingsFor(issue))}/yr
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Fund Costs */}
            <div id="zone-overpaying-fees" className="space-y-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Fund Costs
                </div>
                {feeRisks.length === 0 ? (
                    <div className="text-[11px] text-emerald-500 font-black">✓ All funds are cost-optimal</div>
                ) : (
                    <div className="bg-zinc-950 border border-zinc-900 rounded-sm overflow-hidden">
                        <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                                <tr className="border-b border-zinc-900 text-[9px] font-black uppercase tracking-widest text-zinc-600">
                                    <th className="px-6 py-3">Hold</th>
                                    <th className="px-6 py-3 text-right">ER</th>
                                    <th className="px-6 py-3">Switch To</th>
                                    <th className="px-6 py-3 text-right">ER</th>
                                    <th className="px-6 py-3 text-right">Save / yr</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900/50">
                                {feeRisks.map(r => (
                                    <tr key={r.currentTicker} className="hover:bg-zinc-900/20">
                                        <td className="px-6 py-4 font-black text-zinc-200">{r.currentTicker}</td>
                                        <td className="px-6 py-4 text-right text-rose-400">{(r.currentEr * 100).toFixed(2)}%</td>
                                        <td className="px-6 py-4 text-emerald-400">{r.betterTicker}</td>
                                        <td className="px-6 py-4 text-right text-emerald-400">{(r.betterEr * 100).toFixed(2)}%</td>
                                        <td className="px-6 py-4 text-right font-black text-emerald-400">
                                            ~{dollar(r.potentialSavings)}/yr
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
```

 - [x] **Step 2: Verify TypeScript**

```bash
npm run build 2>&1 | grep -E "error TS|✓ Compiled"
```

 - [x] **Step 3: Commit**

```bash
git add src/app/components/OverpayingProof.tsx
git commit -m "feat: add OverpayingProof component (Zone 3a)"
```

---

## Task 6: Create `AllocationGapProof` (Zone 3b)

**Files:**
- Create: `src/app/components/AllocationGapProof.tsx`

Client component. Shows the CAGR gap, dollar translation, and per-category drift breakdown.

 - [x] **Step 1: Create the component**

```tsx
// src/app/components/AllocationGapProof.tsx
'use client';
import { usePrivacy } from './PrivacyContext';
import type { MetricRow } from '@/lib/logic/xray';

interface CategoryAttribution {
    label: string;
    drift: number;          // e.g. -0.032 = underweight by 3.2%
    estimatedDollars: number;
}

// Note: privacy is read via usePrivacy() internally — not a prop
interface Props {
    currentCagr: number | null;
    targetCagr: number | null;
    portfolioValue: number;
    allocationGapDollars: number;
    categoryAttributions: CategoryAttribution[];
}

export default function AllocationGapProof({
    currentCagr, targetCagr, portfolioValue,
    allocationGapDollars, categoryAttributions,
}: Props) {
    const { privacy } = usePrivacy();
    const cagrDelta = currentCagr !== null && targetCagr !== null ? targetCagr - currentCagr : null;

    const dollar = (n: number) => privacy
        ? <span className="tracking-widest text-zinc-600">•••</span>
        : <span>${Math.round(n).toLocaleString()}</span>;

    return (
        <div id="zone-allocation-gap" className="space-y-6">
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                Allocation Gap
            </div>

            {/* CAGR headline */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-sm p-6 space-y-3">
                <div className="flex items-baseline gap-4">
                    <div>
                        <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">Current expected CAGR</div>
                        <div className="text-2xl font-black text-zinc-200">
                            {currentCagr !== null ? `${(currentCagr * 100).toFixed(1)}%` : '—'}
                        </div>
                    </div>
                    {cagrDelta !== null && (
                        <>
                            <div className="text-zinc-700 text-2xl">→</div>
                            <div>
                                <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">On-target CAGR</div>
                                <div className="text-2xl font-black text-emerald-400">
                                    {targetCagr !== null ? `${(targetCagr * 100).toFixed(1)}%` : '—'}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                {cagrDelta !== null && (
                    <div className="text-[11px] text-zinc-400 border-t border-zinc-900 pt-3">
                        Gap: {(cagrDelta * 100).toFixed(2)}% ×{' '}
                        {privacy ? <span className="tracking-widest text-zinc-600">•••</span> : `$${Math.round(portfolioValue / 1000)}k portfolio`}
                        {' '}={' '}
                        <span className="font-black text-rose-400">~{dollar(allocationGapDollars)} / yr left on the table</span>
                    </div>
                )}
            </div>

            {/* Per-category breakdown */}
            {categoryAttributions.length > 0 && (
                <div className="bg-zinc-950 border border-zinc-900 rounded-sm overflow-hidden">
                    <div className="px-6 py-3 border-b border-zinc-900 text-[9px] font-black uppercase tracking-widest text-zinc-600">
                        Where the drift is
                    </div>
                    <table className="w-full text-left border-collapse text-[11px]">
                        <tbody className="divide-y divide-zinc-900/50">
                            {categoryAttributions.map(cat => {
                                const isUnder = cat.drift < 0;
                                return (
                                    <tr key={cat.label} className="hover:bg-zinc-900/20">
                                        <td className="px-6 py-3 font-black text-zinc-300">{cat.label}</td>
                                        <td className={`px-6 py-3 font-black ${isUnder ? 'text-rose-400' : 'text-amber-400'}`}>
                                            {isUnder ? 'underweight' : 'overweight'}{' '}
                                            {isUnder ? '' : '+'}{(cat.drift * 100).toFixed(1)}%
                                        </td>
                                        <td className="px-6 py-3 text-right font-black text-rose-400">
                                            ~{dollar(cat.estimatedDollars)}/yr
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
```

 - [x] **Step 2: Verify TypeScript**

```bash
npm run build 2>&1 | grep -E "error TS|✓ Compiled"
```

 - [x] **Step 3: Commit**

```bash
git add src/app/components/AllocationGapProof.tsx
git commit -m "feat: add AllocationGapProof component (Zone 3b)"
```

---

## Task 7: Rewrite `audit/page.tsx`

**Files:**
- Modify: `src/app/audit/page.tsx`

Wire all four zones together. Add all new dollar computations. Remove `AlphaPerformance`, `MacroInsights`, and the old metrics table. Keep `ComparisonPanel`.

The `RiskAdjustedPanel` needs VTI performance metrics and simulated target/proposed metrics. VTI 1Y return is computed from `price_history`. Target simulation reuses the existing `simulateAllocationNAV` call (already in the page). Proposed simulation is handled client-side by `ComparisonPanel` pattern — for now, pass `proposed={null}` (Zone 4 already shows proposed comparison; Zone 2 proposed column is a future enhancement once draft weights are available server-side via a query param).

 - [x] **Step 1: Rewrite `audit/page.tsx`**

```tsx
// src/app/audit/page.tsx
import { calculatePortfolioEfficiency } from '@/lib/logic/efficiency';
import { calculateHierarchicalMetrics, calculatePortfolioExpectedCagr, calculateTargetExpectedCagr } from '@/lib/logic/xray';
import { getExpenseRisks, getTaxPlacementIssues } from '@/lib/logic/xray_risks';
import { calculatePortfolioPerformance } from '@/lib/logic/portfolioEngine';
import { flattenLeafWeights, simulateAllocationNAV, ETF_PROXY_MAP } from '@/lib/logic/allocationSimulator';
import db from '@/lib/db/client';
import targetTree from '@/lib/data/target_allocation.json';
import ComparisonPanel from '../components/ComparisonPanel';
import CostOfInactionHero from '../components/CostOfInactionHero';
import RiskAdjustedPanel from '../components/RiskAdjustedPanel';
import OverpayingProof from '../components/OverpayingProof';
import AllocationGapProof from '../components/AllocationGapProof';

export default async function AuditPage() {
    // ── Core data ────────────────────────────────────────────────────────────
    const efficiency = calculatePortfolioEfficiency();
    const metrics    = calculateHierarchicalMetrics();
    const perf       = calculatePortfolioPerformance();
    const currentCagr = calculatePortfolioExpectedCagr(metrics);
    const targetCagr  = calculateTargetExpectedCagr(metrics);
    const expenseRisks = getExpenseRisks();
    const taxIssues    = getTaxPlacementIssues();

    const tv = perf.totalPortfolioValue;

    // ── Dollar conversions ───────────────────────────────────────────────────
    const taxDragDollars       = tv > 0 ? (efficiency.locationDragBps / 10000) * tv : 0;
    const feeDragDollars       = tv > 0 ? (efficiency.expenseDragBps  / 10000) * tv : 0;
    const cagrDelta            = currentCagr !== null && targetCagr !== null ? targetCagr - currentCagr : null;
    const allocationGapDollars = tv > 0 && cagrDelta !== null ? cagrDelta * tv : 0;

    // ── Per-category drift attribution ───────────────────────────────────────
    const level2Rows = metrics.filter(m => m.level === 2 && Math.abs(m.actualPortfolio - m.expectedPortfolio) > 0.005);
    const totalAbsDrift = level2Rows.reduce((s, m) => s + Math.abs(m.actualPortfolio - m.expectedPortfolio), 0);
    const categoryAttributions = level2Rows
        .map(m => {
            const drift = m.actualPortfolio - m.expectedPortfolio;
            const share = totalAbsDrift > 0 ? Math.abs(drift) / totalAbsDrift : 0;
            return { label: m.label, drift, estimatedDollars: share * allocationGapDollars };
        })
        .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))
        .slice(0, 6);

    // ── VTI 1Y return ────────────────────────────────────────────────────────
    const vtiRows = db.prepare(`
        SELECT date, close FROM price_history
        WHERE ticker = 'VTI' AND date >= date('now', '-1 year')
        ORDER BY date ASC
    `).all() as { date: string; close: number }[];
    const vtiReturn1y = vtiRows.length >= 2
        ? (vtiRows[vtiRows.length - 1].close / vtiRows[0].close) - 1
        : null;

    // ── Target simulation (1yr window) ───────────────────────────────────────
    const simStart = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split('T')[0]; })();
    const simEnd   = new Date().toISOString().split('T')[0];
    const targetWeights  = flattenLeafWeights(targetTree as Record<string, unknown>);
    const allProxyTickers = [...new Set([...Object.values(ETF_PROXY_MAP), 'VTI'])];
    const priceHistory: Record<string, Record<string, number>> = {};
    for (const ticker of allProxyTickers) {
        const rows = db.prepare(`SELECT date, close FROM price_history WHERE ticker = ? AND date >= ? AND date <= ? ORDER BY date ASC`).all(ticker, simStart, simEnd) as { date: string; close: number }[];
        if (rows.length > 0) priceHistory[ticker] = Object.fromEntries(rows.map(r => [r.date, r.close]));
    }
    const targetSim = simulateAllocationNAV(targetWeights, priceHistory, simStart, simEnd);
    const targetReturn1y = targetSim && targetSim.nav.length >= 2
        ? (targetSim.nav[targetSim.nav.length - 1] / targetSim.nav[0]) - 1
        : null;
    const targetVol = targetSim && targetSim.dailyLogReturns.length >= 20
        ? (() => { const r = targetSim.dailyLogReturns; const m = r.reduce((a,b)=>a+b,0)/r.length; return Math.sqrt(r.reduce((a,v)=>a+(v-m)**2,0)/r.length * 252); })()
        : null;

    // ── Beta-adjusted expected return ────────────────────────────────────────
    const RF = 0.05;
    const betaAdjustedExpected = perf.beta !== null && vtiReturn1y !== null
        ? RF + perf.beta * (vtiReturn1y - RF)
        : null;

    // ── Verdict sentence ─────────────────────────────────────────────────────
    const verdictParts: string[] = [];
    if (perf.annualizedVol !== null && vtiReturn1y !== null && perf.return1y !== null) {
        const moreRisk   = perf.annualizedVol > 0.12;
        const moreReturn = perf.return1y > (vtiReturn1y ?? 0);
        verdictParts.push(
            moreRisk
                ? `You took more risk than VTI.`
                : `You took less risk than VTI.`
        );
        verdictParts.push(
            moreReturn
                ? `You earned ${((perf.return1y - (vtiReturn1y ?? 0)) * 100).toFixed(1)}% more return.`
                : `You earned ${(((vtiReturn1y ?? 0) - perf.return1y) * 100).toFixed(1)}% less return.`
        );
        if (perf.sharpe !== null) {
            verdictParts.push(perf.sharpe > 1.0 ? 'Sharpe suggests risk is compensated.' : 'Sharpe suggests risk may not be fully compensated.');
        }
    }
    const verdict = verdictParts.join(' ') || 'Insufficient price history for verdict.';

    // ── Snapshot objects for RiskAdjustedPanel ───────────────────────────────
    const currentSnap = {
        return1y:     perf.return1y,
        annualizedVol: perf.annualizedVol,
        sharpe:       perf.sharpe,
        sortino:      perf.sortino,
        beta:         perf.beta,
        maxDrawdown:  perf.maxDrawdown,
        expectedCagr: currentCagr,
    };
    const targetSnap = {
        return1y:     targetReturn1y,
        annualizedVol: targetVol,
        sharpe:       null,
        sortino:      null,
        beta:         null,
        maxDrawdown:  null,
        expectedCagr: targetCagr,
    };
    const vtiSnap = {
        return1y:     vtiReturn1y,
        annualizedVol: null,
        sharpe:       null,
        sortino:      null,
        beta:         1.0,
        maxDrawdown:  null,
        expectedCagr: null,
    };

    return (
        <main className="min-h-screen bg-black text-white font-mono selection:bg-emerald-500/30">
            <div className="page-container space-y-16">

                {/* Zone 1 — Cost of Inaction Hero */}
                <CostOfInactionHero
                    taxDragDollars={taxDragDollars}
                    taxDragBps={efficiency.locationDragBps}
                    taxIssueCount={taxIssues.length}
                    feeDragDollars={feeDragDollars}
                    feeDragBps={efficiency.expenseDragBps}
                    feeIssueCount={expenseRisks.length}
                    allocationGapDollars={allocationGapDollars}
                    allocationGapCagrDelta={cagrDelta}
                />

                {/* Zone 2 — Risk-Adjusted Performance */}
                <RiskAdjustedPanel
                    current={currentSnap}
                    target={targetSnap}
                    vti={vtiSnap}
                    proposed={null}
                    betaAdjustedExpected={betaAdjustedExpected}
                    verdict={verdict}
                />

                {/* Zone 3 — Cost Proof */}
                <section className="space-y-16">
                    <h2 className="text-[9px] font-black uppercase tracking-widest text-zinc-700">
                        Why You're Paying More Than You Should
                    </h2>
                    <OverpayingProof
                        taxIssues={taxIssues}
                        feeRisks={expenseRisks}
                        totalTaxDragDollars={taxDragDollars}
                        portfolioValue={tv}
                    />
                </section>

                <AllocationGapProof
                    currentCagr={currentCagr}
                    targetCagr={targetCagr}
                    portfolioValue={tv}
                    allocationGapDollars={allocationGapDollars}
                    categoryAttributions={categoryAttributions}
                />

                {/* Zone 4 — Supporting Evidence */}
                <section className="space-y-6">
                    <h2 className="text-[9px] font-black uppercase tracking-widest text-zinc-700">
                        Supporting Evidence
                    </h2>
                    <ComparisonPanel />
                </section>

                <footer className="pt-12 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-800 font-black uppercase tracking-[0.4em] opacity-50">
                    <span>Performance Engine: Sage Efficiency Analyst</span>
                    <span>SAGE v2.0.42</span>
                </footer>
            </div>
        </main>
    );
}
```

 - [x] **Step 2: Run full build to confirm no type errors**

```bash
npm run build 2>&1 | tail -20
```
Expected: clean build, no `error TS` lines

 - [x] **Step 3: Start dev server and manually verify**

```bash
PORT=3005 npm run dev
```

Check at `http://localhost:3005/audit`:
- Hero shows total drag with three tiles
- Uncompensated risk line leads Zone 2
- Zone 2 table has CURRENT, Δ TARGET, Δ VTI columns
- Tax placement table shows misplacements (or "✓ optimized")
- Fee table shows swappable funds (or "✓ optimized")
- Allocation gap shows CAGR delta and per-category breakdown
- ComparisonPanel still renders at the bottom
- Privacy toggle (in NavBar) hides all dollar amounts across all zones

 - [x] **Step 4: Commit**

```bash
git add src/app/audit/page.tsx
git commit -m "feat: rewrite audit page as cost-of-inaction dashboard"
```

---

## Task 8: Final cleanup

 - [x] **Step 1: Remove unused imports from the old page**

Check that `AlphaPerformance` and `MacroInsights` are not imported anywhere outside their own files. If they are only used on the old audit page (now removed), they can be left in place but orphaned — no deletion needed unless you want to tidy.

```bash
grep -r "AlphaPerformance\|MacroInsights" src/app --include="*.tsx" --include="*.ts"
```
If only the component files themselves appear, they are safely orphaned.

 - [x] **Step 2: Run all tests**

```bash
npx vitest run
```
Expected: all tests passing

 - [x] **Step 3: Final build check**

```bash
npm run build 2>&1 | tail -10
```
