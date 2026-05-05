# Issue 7: Fix Seed Strategy Import Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the incorrect relative import path in `scripts/seed_strategy.ts` to resolve build-time TypeScript errors.

**Architecture:** Correcting a filesystem-relative path reference to align with the project directory structure.

**Tech Stack:** TypeScript

---

### Task 1: Update Import Path

**Files:**
- Modify: `scripts/seed_strategy.ts`

- [ ] **Step 1: Fix the import statement**

```typescript
// scripts/seed_strategy.ts
import db from '../src/lib/db/client';
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build should no longer fail with "Cannot find module './src/lib/db/client'" in `scripts/seed_strategy.ts`.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed_strategy.ts
git commit -m "fix: correct import path in seed_strategy script"
```
