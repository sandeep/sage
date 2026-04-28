# Holdings UI Redesign

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Aggregate holdings view grouped by ticker, account drill-down, human account names

---

## Problem

The current `/holdings` page displays a flat list of holding rows — one row per `(ticker, account)` pair, sorted by value. This makes it hard to see total exposure to a position across accounts. Account IDs are displayed rather than human-readable names.

Additionally:
- The `accounts` table has no `nickname` column despite the holdings page querying `a.nickname` (schema drift)
- The `holdings` table has no `market_value` column in `schema.sql` despite it being used throughout (schema drift)

---

## Goals

1. Group holdings by ticker — show one top-level row per ticker with total value across all accounts
2. Each ticker row expands to show the accounts that hold it, with per-account quantity and value
3. Show human account name (`nickname`) when set; fall back to account ID
4. Fix schema drift: add `nickname` to `accounts`, add `market_value` to `holdings`

---

## Out of Scope

- Inline editing of holdings quantities or values
- Sorting/filtering controls (future)
- Integration with `asset_registry` canonical names (depends on Asset Registry spec; add canonical name display once that DB table exists)

---

## Data Model

### Schema fixes (additive migrations)

```sql
ALTER TABLE accounts ADD COLUMN nickname TEXT;
ALTER TABLE holdings ADD COLUMN market_value REAL;
```

Both are nullable — no existing data is broken. `nickname` is set by the user via Account Management. `market_value` is populated on CSV import.

---

## Holdings Page Data Query

```sql
SELECT
    h.ticker,
    SUM(h.quantity) as total_quantity,
    SUM(CASE WHEN h.market_value > 0 THEN h.market_value ELSE 0 END) as total_market_value,
    COUNT(DISTINCT h.account_id) as account_count
FROM holdings h
GROUP BY h.ticker
ORDER BY total_market_value DESC
```

Per-account detail (loaded for each expanded ticker):
```sql
SELECT
    h.account_id,
    COALESCE(a.nickname, a.id) as display_name,
    a.provider,
    a.tax_character,
    h.quantity,
    h.market_value
FROM holdings h
JOIN accounts a ON h.account_id = a.id
WHERE h.ticker = ?
ORDER BY h.market_value DESC
```

---

## UI Structure

### Top-level ticker rows

Each row shows:
- **Ticker** (bold) — with asset type badge if known (EQUITY / 1256 / OPTION)
- **Total quantity** across all accounts
- **Implied price** — `total_market_value / total_quantity` if market_value is available; otherwise latest `price_history` close; otherwise `—`
- **Total market value** — sum across accounts; if no price data shows `—` (never `$0` or `$100`)
- **# Accounts** — e.g. "3 accounts"
- Expand chevron

If `market_value` is null or 0 for all rows of this ticker: render value cell as `—` with a yellow dot indicator.

### Expanded account sub-rows

Indented under the ticker row, one per account:
- **Account name** — `COALESCE(nickname, account_id)`
- **Provider** — e.g. "Fidelity"
- **Tax character** — ROTH / DEFERRED / TAXABLE badge
- **Quantity** in this account
- **Value** in this account (or `—`)

### Header

Unchanged from current design. Grand total uses same `market_value` precedence rule as the rest of the app (market_value > price_history > null).

### Warning strip

If any tickers have no price data: "X positions unpriced — values may be incomplete" shown below the header.

---

## Account Nickname

The `AccountMapper` component (already exists at `src/app/components/AccountMapper.tsx`) manages accounts. It needs a `nickname` input field added — a free-text label the user sets to identify the account (e.g. "Sandeep Roth IRA", "Joint Taxable"). This is stored in `accounts.nickname`.

The `/api/accounts` route needs to accept and persist `nickname` on create and update.

---

## Files Changed

| File | Action |
|---|---|
| `src/lib/db/schema.sql` | Add `nickname TEXT` to accounts, `market_value REAL` to holdings (via ALTER in migration script) |
| `src/lib/db/migrate.ts` | New or update — runs ALTER TABLE statements idempotently |
| `src/app/holdings/page.tsx` | Rewrite — aggregated ticker rows with expandable account sub-rows |
| `src/app/components/AccountMapper.tsx` | Add `nickname` input field |
| `src/app/api/accounts/route.ts` | Accept and persist `nickname` |
