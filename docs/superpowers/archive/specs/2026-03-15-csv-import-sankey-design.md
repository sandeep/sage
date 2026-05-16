# CSV Import Parser Fix & Sankey Visualization

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Fix Fidelity CSV column mapping; add import result visualization (Sankey) showing every row is accounted for

---

## Problem

1. **Parser reliability:** The Fidelity CSV export format has known column positions. The parser currently relies solely on header name matching (`header.indexOf('Symbol')`), which can silently return -1 if Fidelity changes header text or if there are encoding/whitespace differences. There's no positional fallback.

2. **Import opacity:** After uploading a CSV, the user has no way to verify that every row was processed correctly. Rows can be silently skipped (empty ticker, missing account ID, footer lines, etc.). There is no feedback on what was parsed, what was skipped, and why.

---

## Fidelity CSV Column Reference

Fidelity's full portfolio export column order:

| Col | Letter | Header name |
|-----|--------|-------------|
| 0 | A | Account Number |
| 1 | B | Account Name |
| 2 | C | Symbol |
| 3 | D | Description |
| 4 | E | Quantity |
| 5 | F | Last Price |
| 6 | G | Last Price Change |
| 7 | H | Current Value |
| 8 | I | Today's Gain/Loss Dollar |
| 9 | J | Today's Gain/Loss Percent |
| 10 | K | Total Gain/Loss Dollar |
| 11 | L | Total Gain/Loss Percent |
| 12 | M | Percent Of Account |
| 13 | N | Cost Basis Total |
| 14 | O | Average Cost Basis |
| 15 | P | Type |

**Key columns:** Symbol (C/2), Description (D/3), Quantity (E/4), Current Value (H/7), Account Number (A/0), Account Name (B/1), Cost Basis Total (N/13).

---

## Goals

1. Make the Fidelity parser robust: use header names as primary lookup, fall back to positional indices (above) if a header name is not found
2. After import, return a structured parse result (rows ingested, rows skipped + reason, rows unmapped)
3. Show a Sankey diagram on the import result page that visualizes: CSV rows → tickers → asset categories

---

## Parser Fix: `parseFidelityHoldings`

### Positional fallback

After looking up each column by header name, if `indexOf()` returns -1, fall back to the known positional index:

```ts
const idx = (name: string, fallback: number) => {
    const found = header.indexOf(name);
    return found >= 0 ? found : fallback;
};

const tickerIdx    = idx('Symbol', 2);
const descIdx      = idx('Description', 3);
const quantityIdx  = idx('Quantity', 4);
const valueIdx     = idx('Current Value', 7);
const accNumIdx    = idx('Account Number', 0);
const accNameIdx   = idx('Account Name', 1);
const costIdx      = idx('Cost Basis Total', 13);
```

### Parse result type

`parseFidelityHoldings` returns a structured result instead of a bare array:

```ts
interface ParseResult {
    holdings: Holding[];
    skipped: Array<{ line: string; reason: string }>;
    unmapped: Array<{ ticker: string; description: string }>;  // parsed but not in asset_registry
}
```

- **holdings:** rows successfully parsed
- **skipped:** rows discarded and why ("empty ticker", "missing account ID", "footer line", "zero quantity")
- **unmapped:** rows parsed successfully but ticker not found in `asset_registry` — these are ingested normally but flagged for the visualization

---

## Sankey Visualization

### What it shows

After a successful import, the upload result page renders a Sankey diagram:

```
[CSV Account rows]  →  [Tickers]  →  [Asset Categories]
```

- **Left nodes:** one per account found in the CSV (e.g. "Sandeep Roth IRA", "Joint Taxable")
- **Middle nodes:** one per unique ticker parsed from that account
- **Right nodes:** asset categories from `asset_registry` weights (e.g. "US Large Cap", "Emerging Market", "Cash")
- **Flow width:** proportional to dollar value
- **Skipped rows:** shown as a separate "Unaccounted" right node — flows of rows that were skipped or unmapped
- **Unmapped tickers:** flow into an "Unmapped" category node, colored yellow/amber

### Completeness guarantee

Every CSV row must appear in the diagram — either flowing to a category or flowing to "Skipped" or "Unmapped". The total value of all flows = total value parsed from CSV. This is the visual proof that nothing was silently dropped.

### Implementation

- Built with [D3.js `d3-sankey`](https://github.com/d3/d3-sankey) or a lightweight SVG-based implementation
- Rendered as a client component on the `/accounts` page after upload completes
- The `/api/upload` route returns the `ParseResult` (holdings + skipped + unmapped) in its response
- The Sankey is built from the response data client-side — no additional API call needed
- Nodes are sized by value; minimum visual size enforced so zero-value nodes (skipped rows with no value) are still visible as thin lines

### Upload API response change

`POST /api/upload` currently returns `{ message: string }`. Change to:

```ts
{
    message: string;
    result: {
        ingested: number;
        skipped: Array<{ line: string; reason: string }>;
        unmapped: Array<{ ticker: string; description: string }>;
        sankey: {
            nodes: Array<{ id: string; label: string; type: 'account' | 'ticker' | 'category' | 'unaccounted' }>;
            links: Array<{ source: string; target: string; value: number }>;
        };
    }
}
```

The `sankey` data is pre-computed server-side (joining parse result with `asset_registry`) so the client just renders it.

---

## Files Changed

| File | Action |
|---|---|
| `src/lib/ingest/parsers.ts` | Add positional fallback to `parseFidelityHoldings`; change return type to `ParseResult` |
| `src/app/api/upload/route.ts` | Update to return structured `ParseResult` + pre-computed sankey data |
| `src/app/components/SankeyChart.tsx` | New — client component, renders sankey from nodes/links data |
| `src/app/accounts/page.tsx` | Update — show `SankeyChart` after upload with parse summary (ingested, skipped, unmapped counts) |
