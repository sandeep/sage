# Rebalancer: Account-Aware Directive Generation
**Date:** 2026-03-19
**Status:** Draft
**Affects:** `src/lib/logic/rebalancer.ts`, `src/app/components/TaskBlotter.tsx` (display only)

---

## Problem Statement

The current rebalancer generates SELL and BUY directives independently:

1. SELL: find the account holding the most of the overweight ticker
2. BUY: find the account with the right tax character for the underweight category

These are stitched together in the blotter as if they form a coordinated rebalance, but they aren't. The result: "sell $20k VXUS in Vanguard Trad IRA, buy $20k VTI in Vanguard Roth IRA" — two separate accounts, different tax characters, no cash flow between them. This is not how rebalancing works.

**Money cannot spontaneously move between accounts.** Each directive must describe a complete, self-contained action that can be executed without depending on proceeds from another directive.

---

## Core Constraint

A directive is only valid if its account already has the cash or holdings to execute it independently:

| Directive type | Valid when |
|---|---|
| **SELL** | Account holds the ticker |
| **DEPLOY_CASH** | Account has idle cash ≥ MIN_IDLE_CASH |
| **WITHIN_ACCOUNT_SWAP** | Account has an overweight holding AND is the right tax venue for the underweight target |
| ~~BUY paired with SELL in different account~~ | **Never valid** |

---

## Account Taxonomy

The `accounts.account_type` column (IRA, ROTH_IRA, BROKERAGE, HSA, BANKING) controls what a directive can say about an account:

| account_type | tax_character | Investable? | Notes |
|---|---|---|---|
| BROKERAGE | TAXABLE | Yes | Standard taxable account |
| IRA | DEFERRED | Yes | Traditional IRA / 401k / Rollover |
| ROTH_IRA | ROTH | Yes | Roth IRA / Roth 401k |
| HSA | ROTH | Yes | Health savings, treat like Roth for placement |
| BANKING | TAXABLE | **No** | Checking/savings — never a buy/sell venue |
| UNKNOWN | TAXABLE | **No** | Auto-created, not classified — skip until bootstrapped |

---

## Revised Directive Generation Algorithm

Replace the current three-pass approach (overweight SELLs → underweight BUYs → cash deployment) with an account-first pass:

### Pass 1 — DEPLOY_CASH (unchanged logic, tightened eligibility)

For each investable account with idle cash ≥ MIN_IDLE_CASH:
- Find the most underweight L2 category whose preferred tax character matches this account's tax character
- If found: emit `DEPLOY_CASH` — "Deploy $Xk → TICKER in ACCOUNT"
- This is account-local: the cash is already there

### Pass 2 — WITHIN_ACCOUNT_SWAP

For each investable account:
1. Find overweight L2 categories where this account holds a ticker (the "sell side")
2. Find underweight L2 categories where this account's tax character is preferred (the "buy side")
3. If both exist: emit a paired `REBALANCE` directive describing both legs — "Sell $Xk TICKER_A → buy TICKER_B in ACCOUNT"
4. Cap at MAX_TRANCHE_SIZE per swap

This is the only case where a sell and buy are described together — because they're in the same account.

### Pass 3 — STANDALONE TRIM

For overweight L2 categories not already addressed by a swap in Pass 2:
- Find the account holding the most of the overweight ticker
- Emit a standalone `SELL` — "Trim $Xk TICKER in ACCOUNT (hold proceeds as cash)"
- No implied BUY destination; the sell raises cash that Pass 1 will deploy on the next cycle

### What is NOT generated

- BUY directives for accounts that do not already have idle cash (cannot fund it)
- Any directive pairing a sell in account A with a buy in account B (different accounts)
- Directives for BANKING or UNKNOWN account_type accounts

---

## Provider Isolation

Even within the same provider, accounts are NOT interchangeable:
- Fidelity Rollover IRA (DEFERRED) and Fidelity Roth IRA (ROTH) are separate accounts — you cannot move money between them without tax consequences (conversion rules apply)
- Fidelity Individual Brokerage and a second Fidelity Individual Brokerage are technically transferable but this should not be assumed — each directive must be self-contained

**Rule: provider is irrelevant to directive validity. Account ID is the unit of isolation.**

---

## Tax Relocation vs. Rebalancing

The current rebalancer conflates two distinct operations:

| Operation | What it is | Where handled |
|---|---|---|
| **Rebalancing** | Fix drift from target allocation | `rebalancer.ts` → TaskBlotter |
| **Tax relocation** | Move a holding to a better tax venue | `xray_risks.getTaxPlacementIssues()` → OverpayingProof |

The rebalancer should NOT emit directives like "move REIT from taxable to IRA." That is a tax optimization action, already surfaced in the Performance page's OverpayingProof zone. Conflating the two produces impossible instructions (you can't "sell in taxable and buy in IRA" as a rebalance — you're reducing taxable exposure AND making a new IRA contribution/conversion, which has separate rules and limits).

---

## Directive Description Format

Current format is inconsistent. Standardize:

| Type | Format |
|---|---|
| DEPLOY_CASH | `Deploy $Xk cash → TICKER in PROVIDER ACCOUNT` |
| REBALANCE (within-account swap) | `Swap $Xk TICKER_A → TICKER_B in PROVIDER ACCOUNT` |
| SELL (standalone trim) | `Trim $Xk TICKER in PROVIDER ACCOUNT · hold proceeds` |

The account label must uniquely identify the account. If two accounts have the same nickname at the same provider, append a disambiguator from the account ID (last 4 chars of numeric ID, or last segment of UUID).

---

## Reasoning Field

Each directive's `reasoning` field must state:
- The portfolio-level gap being addressed
- The account's available capital (cash balance for DEPLOY, holding value for SELL/SWAP)

Examples:
- `$45k gap in REIT · $12k idle in Fidelity Roth IRA`
- `Small Cap Value +3.2% overweight · 420 shares VBR in Fidelity Rollover IRA`
- `Total Stock Market -4.1% underweight · trimming proceeds stay as cash`

---

## Data Requirements

The rebalancer query must include `account_type` in the accounts fetch (already fetched via `SELECT *` but used in only one place). Add explicit guard:

```typescript
const investableAccounts = accounts.filter(a =>
    a.account_type !== 'BANKING' &&
    a.provider !== 'UNKNOWN'
);
```

The `getCashByAccount()` function is correct as-is but should only be consulted for investable accounts.

---

## Edge Cases

**Multiple accounts of the same tax character at the same provider:**
- Fidelity has two DEFERRED accounts (Rollover IRA + Traditional IRA)
- For SELL: prefer the account actually holding the ticker — already correct
- For DEPLOY_CASH: prefer the account with the most idle cash — already correct
- For WITHIN_ACCOUNT_SWAP: evaluate each account independently; may emit two swaps

**Account has overweight in category A and B, underweight in C:**
- Emit one swap (A→C) and one standalone TRIM (B)
- Don't try to combine; each directive should be independently executable

**Underweight category has no investable account with matching tax character:**
- Emit nothing — do not fall back to a wrong-tax-character account
- This is a portfolio structure problem, not a rebalancing problem (surfaces in OverpayingProof instead)

**HSA accounts:**
- Treat as ROTH for placement purposes
- Only buy investment-grade ETFs (no individual stocks) — enforce by checking `asset_type` in asset_registry

---

## Out of Scope

- **Backdoor Roth / Roth conversion**: explicit tax strategy actions; a separate workflow
- **401k contribution routing**: depends on plan options not in the DB
- **Tax-loss harvesting**: separate concern; requires cost basis history
- **New external cash contributions**: `DEPLOY_CASH` covers idle cash already in accounts; directing new contributions is a future feature

---

## Files to Change

| File | Change |
|---|---|
| `src/lib/logic/rebalancer.ts` | Full algorithm rewrite per this spec |
| `src/app/components/TaskBlotter.tsx` | Update to render `REBALANCE` directive type with both legs visible |
| `src/lib/logic/__tests__/rebalancer.test.ts` | New tests covering cross-account rejection, BANKING exclusion, within-account swap |
