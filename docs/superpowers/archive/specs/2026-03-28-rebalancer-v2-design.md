# Rebalancer V2 Design

## Goal

Replace the current TaskBlotter with a proper Rebalance Queue: account-grouped trade cards with account-aware instrument selection, manual execution tracking (OPEN → SCHEDULED → DONE), and done-gated tranche progression for large positions.

## Architecture

A new `/rebalancer` page (added to NavBar) backed by the existing `directives` table with two schema additions: `status` states expanded to include `SCHEDULED` and `scheduled_date`, plus a new `account_instrument_allowlist` table for the optional per-account preferred-ticker list (Tier C).

The directive engine (`rebalancer.ts`) already produces $20k-max tranches. The UI layers account grouping, instrument resolution, and state management on top without changing the core math.

## Pages & Components

### `/rebalancer` page (`src/app/rebalancer/page.tsx`)

Server Component. Reads all open/scheduled directives from DB grouped by account. Passes to `RebalanceQueue` client component.

### `RebalanceQueue` (`src/app/rebalancer/RebalanceQueue.tsx`)

Client Component. Renders one `AccountPanel` per account. Handles optimistic state updates (mark done, schedule, snooze) via server actions.

### `AccountPanel`

Each panel shows:
- Header: account name, tax character, balance, open count
- Trade cards in order: open tranches first, then locked tranches (faded/dashed), then completed (struck-through, faded)
- Footer: tranche progression hint ("Mark tranche 1 done to unlock tranche 2" / "Tranche 2 unlocked · suggested Apr 11")

### `TradeCard`

Single trade. Displays:
- Ticker + amount (green for buy, rose for sell/trim)
- Subtitle line: asset class + instrument reasoning (e.g. "Total Market · already in this account", "Small Cap Value · best ETF for this slot — not yet held")
- State-dependent action row:
  - **OPEN**: `SCHEDULE` button + `DONE` button + `SNOOZE` button
  - **OPEN → Schedule clicked**: inline date input appears, confirm button
  - **SCHEDULED**: amber "SCHED Apr 2" badge, no action buttons
  - **DONE**: struck-through, faded, "done Apr 2" in subtitle
  - **LOCKED**: dashed border, faded, "locked" in subtitle, no actions

## Instrument Resolution

For each directive (asset class slot + account), the resolver picks the best ticker in priority order:

**Tier D — Already held in this account**
Query `holdings` for the account. If any holding maps to the target asset class via `asset_registry.weights`, use it. Subtitle: "already in this account".

**Tier C — Per-account allowlist (optional)**
Query `account_instrument_allowlist` for the account. Match by asset class. Subtitle: "on your allowlist for this account".

**Tier B — Provider match**
Map account provider to preferred tickers (e.g. `VANGUARD → {TSM: VIIIX, SCV: VSIAX, BOND: VBTLX}`, `FIDELITY → {TSM: FZROX, BOND: FXNAX}`). Subtitle: "Vanguard Admiral, 0.07% ER — not yet held".

**Tier DEFAULT — Core ETF**
Fall back to `ETF_PROXY_MAP` in `allocationSimulator.ts`. Subtitle: "best available ETF for this slot — not yet held".

The resolved ticker replaces the generic asset-class label in the directive. Resolution runs at render time (not stored), so it updates as holdings change.

## Trade States

```
OPEN
  ├─ → SCHEDULED  (user enters settlement date; unlocks next tranche immediately)
  │     └─ → DONE (auto, when scheduled_date <= today on page load)
  ├─ → DONE       (user clicks Done; unlocks next tranche)
  └─ → SNOOZED    (deferred; resurfaces after 7 days; does not unlock tranches)
```

- Both SCHEDULED and DONE unlock the next tranche for that account + asset class
- SNOOZED does not block other trades; it just disappears from the active queue until it resurfaces

## Tranche Logic

Tranches are existing directives for the same account + asset class (already split at $20k by `generateDirectives`). Display rules:

- Show only the **lowest-numbered open tranche** as active
- Subsequent tranches are **locked** (dashed border, faded, no actions) until the prior one is SCHEDULED or DONE
- When a tranche is unlocked, the footer shows "suggested [date]" = locked tranche's `created_at` + 14 days
- Completed tranches remain visible but struck-through to show progress

## Schema Changes

### `directives` table — two new columns

```sql
ALTER TABLE directives ADD COLUMN scheduled_date TEXT;   -- ISO date, nullable
ALTER TABLE directives ADD COLUMN resolved_ticker TEXT;  -- cached resolution, nullable
```

`status` already exists. Add `SCHEDULED` as a valid value alongside `OPEN`, `ACCEPTED`, `SNOOZED`, `EXECUTED`.

### New table: `account_instrument_allowlist`

```sql
CREATE TABLE IF NOT EXISTS account_instrument_allowlist (
    account_id    TEXT NOT NULL,
    ticker        TEXT NOT NULL,
    asset_class   TEXT NOT NULL,   -- matches allocation label, e.g. "Small Cap Value"
    added_at      TEXT DEFAULT (date('now')),
    PRIMARY KEY (account_id, ticker)
);
```

This table starts empty. It grows as the user confirms "use this ticker in this account" (future feature; resolver checks it on every load even if empty).

## Server Actions

### `scheduleDirective(id: number, date: string)`
Sets `status = 'SCHEDULED'`, `scheduled_date = date`. Returns updated directive.

### `completeDirective(id: number)`
Sets `status = 'EXECUTED'`, `scheduled_date = today` if not already set.

### `snoozeDirective(id: number)`
Sets `status = 'SNOOZED'`, stores snooze expiry as `scheduled_date = today + 7 days`.

### `autoCompleteScheduled()`
Called on page load. Finds all `status = 'SCHEDULED'` directives where `scheduled_date <= today`. Marks them `EXECUTED`. Returns count updated.

## NavBar

Add `/rebalancer` between Accounts and Holdings:

```ts
{ href: '/rebalancer', label: 'Rebalancer' },
```

## Provider Map (Tier B)

Defined as a constant in a new file `src/lib/logic/instrumentResolver.ts`:

```ts
const PROVIDER_INSTRUMENT_MAP: Record<string, Record<string, string>> = {
  VANGUARD: {
    'Total Stock Market': 'VIIIX',
    'Small Cap Value': 'VSIAX',
    'US Aggregate Bond': 'VBTLX',
    'Developed Market': 'VTMGX',
    'Emerging Market': 'VEMAX',
    'REIT': 'VGSLX',
  },
  FIDELITY: {
    'Total Stock Market': 'FZROX',
    'US Aggregate Bond': 'FXNAX',
    'Small Cap Value': 'FISVX',
    'Developed Market': 'FSPSX',
  },
  SCHWAB: {
    'Total Stock Market': 'SCHB',
    'US Aggregate Bond': 'SCHZ',
    'Small Cap Value': 'DFSVX',
  },
};
```

`resolveInstrument(accountId, assetClass)` runs D → C → B → DEFAULT and returns `{ ticker, tier, subtitle }`.

## Out of Scope

- Actual brokerage integration (no API calls to Fidelity/Schwab/Vanguard)
- Automatic population of `account_instrument_allowlist` (manual or future feature)
- Tax-lot optimization for TRIM trades (noted in subtitle only)
- Dashboard TaskBlotter — left as-is; Rebalancer is a separate page
