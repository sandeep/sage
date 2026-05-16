# Passive vs Active Workspace Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the application into two philosophically distinct workspaces: "Passive Core" (Index management) and "Active Alpha" (Trading strategy), with symmetric routing and naming.

**Architecture:** 
1. **Passive Workspace (`/passive`):** Performance Dashboard (Headline) and Core Portfolio (Allocation/Ledger).
2. **Active Workspace (`/active`):** Alpha Dashboard (Headline) and Active Ledger (Trades).
3. **URL-Driven Highlighting:** Sidebar derives state from `/passive` or `/active` prefix.
4. **Build Safety:** Surgical relative import fixes to prevent breakages during directory relocation.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS.

---

### Task 1: Physical File Migration

**Files:**
- Create: `src/app/passive/`, `src/app/passive/portfolio/`, `src/app/active/`, `src/app/active/ledger/`
- Move: `src/app/performance/` -> `src/app/passive/`
- Move: `src/app/page.tsx` -> `src/app/passive/portfolio/page.tsx`
- Move: `src/app/alpha/page.tsx` -> `src/app/active/page.tsx`
- Move: `src/app/alpha/trades/` -> `src/app/active/ledger/`

- [ ] **Step 1: Create directory structure**
```bash
mkdir -p src/app/passive/portfolio
mkdir -p src/app/active/ledger
```

- [ ] **Step 2: Move Passive files**
Move Portfolio Performance to the headline and Portfolio Overview to /portfolio.
```bash
mv src/app/performance/* src/app/passive/
mv src/app/page.tsx src/app/passive/portfolio/page.tsx
rmdir src/app/performance
```

- [ ] **Step 3: Move Active files**
Move Alpha Dashboard to the headline and Trades to /ledger.
```bash
mv src/app/alpha/page.tsx src/app/active/page.tsx
mv src/app/alpha/trades/* src/app/active/ledger/
rm -rf src/app/alpha
```

- [ ] **Step 4: Fix Relative Imports**
Update imports in all moved files to ensure they point to the correct depth for `components` and `lib`.
- Files directly in `passive/` or `active/` (Depth 3): use `../components/` and `../lib/`.
- Files in `passive/portfolio/` or `active/ledger/` (Depth 4): use `../../components/` and `../../lib/`.

---

### Task 2: Title, Subtitle & Header Standardization

**Files:**
- Modify: `src/app/passive/page.tsx`
- Modify: `src/app/passive/portfolio/page.tsx`
- Modify: `src/app/active/page.tsx`
- Modify: `src/app/active/ledger/TradeLogClient.tsx`

- [ ] **Step 1: Update Passive Core Titles**
- `/passive`: Title `PASSIVE CORE`, Subtitle `Strategy & Realized Performance Dashboard`.
- `/passive/portfolio`: Title `CORE PORTFOLIO`, Subtitle `Allocation Tree & Account Mapping`.

- [ ] **Step 2: Update Active Alpha Titles**
- `/active`: Title `ACTIVE ALPHA`, Subtitle `Active Performance vs Passive Allocation`.

- [ ] **Step 3: Refactor Active Ledger Header**
Update `TradeLogClient.tsx` to match the hero standard:
- Title `ACTIVE LEDGER`, Subtitle `Transaction History & Execution Log`.
- Move "Basis" metadata to the far right of the header div.
- Remove the "<- Dashboard" breadcrumb from the hero area.

---

### Task 3: Global Routing & Sidebar

**Files:**
- Create: `src/app/page.tsx`
- Modify: `src/app/components/Sidebar/ConsoleSwitcher.tsx`
- Modify: `src/app/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Implement root redirect**
```tsx
import { redirect } from 'next/navigation';
export default function Root() { redirect('/passive'); }
```

- [ ] **Step 2: Update ConsoleSwitcher**
Derive `activeConsole` from `pathname.startsWith('/active')`.
Update `handleSwitch` targets to `/passive` and `/active`.

- [ ] **Step 3: Update Sidebar Links**
- **Passive Group**: `/passive` (Performance), `/passive/portfolio` (Portfolio).
- **Active Group**: `/active` (Performance), `/active/ledger` (Ledger).

---

### Task 4: Final Build & Visual Verification

- [ ] **Step 1: Verify Build Stability**
Run `nextjs_call(get_errors)` on port 3002 to ensure zero module resolution errors.

- [ ] **Step 2: Empirical UI Check**
Use `browser_eval` to confirm:
- Navigating to `/passive` shows the correct Title/Subtitle.
- Sidebar highlighting correctly follows the active path.
- "Active Ledger" header is clean and standard.
