# CSV Import Fix & Sankey Visualization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Make the Fidelity CSV parser robust with positional fallbacks, return structured parse results (ingested/skipped/unmapped), and render a Sankey diagram after import that proves every CSV row is accounted for.

**Architecture:** `parseFidelityHoldings` returns a typed `ParseResult` instead of a bare array. The `/api/upload` route pre-computes Sankey node/link data server-side and returns it in the response. A new `SankeyChart` client component renders the SVG. The accounts page shows parse summary + Sankey after each upload.

**Tech Stack:** Next.js 15, vitest, D3.js (`d3-sankey` package) for Sankey layout computation.

**Dependency note:** This plan is fully independent. It does not depend on Plans A or B and can run concurrently.

---

## Chunk 1: Parser Fix

### Task 1: Update parseFidelityHoldings to return ParseResult

**Files:**
- Modify: `src/lib/ingest/parsers.ts`
- Modify: `src/lib/ingest/__tests__/parsers.test.ts`

- [x] **Step 1: Write failing tests for ParseResult shape**
- [x] **Step 2: Run — verify failing**
- [x] **Step 3: Rewrite parseFidelityHoldings in parsers.ts**
- [x] **Step 4: Run tests**
- [x] **Step 5: Commit**

---

## Chunk 2: Upload API + Sankey

### Task 2: Install d3-sankey and update /api/upload

**Files:**
- Modify: `src/app/api/upload/route.ts`

- [x] **Step 1: Install d3-sankey**
- [x] **Step 2: Read the current upload route**
- [x] **Step 3: Update /api/upload to return structured result + sankey data**
- [x] **Step 4: Commit**

### Task 3: Create SankeyChart component and wire up to accounts page

**Files:**
- Create: `src/app/components/SankeyChart.tsx`
- Modify: `src/app/accounts/page.tsx`

- [x] **Step 1: Create SankeyChart component**
- [x] **Step 2: Update accounts page to show post-import results**
- [x] **Step 3: Update AccountMapper to call onUploadResult**
- [x] **Step 4: Test the full flow**
- [x] **Step 5: Commit**
