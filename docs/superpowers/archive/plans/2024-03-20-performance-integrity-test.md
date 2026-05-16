# Ground Truth Benchmark Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Implement a benchmark test to verify the `portfolioEngine.ts` performance calculations against a mathematically known ground truth.

**Architecture:** Use Vitest to interact with the in-memory SQLite test database. We will seed a synthetic 252-day price history for 'VTI' with linear 10% growth (from $100 to $110). We will also seed a simple portfolio holding 100 shares of 'VTI'. Then, we'll invoke the performance engine and assert the expected 1-year return (exactly 10%) and verify that the calculated volatility accurately reflects our mock price series.

**Tech Stack:** TypeScript, Vitest, Better-SQLite3, Node.js

---

### Task 1: Create the Performance Integrity Test

**Files:**
- Create: `src/lib/logic/__tests__/performance_integrity.test.ts`

 - [x] **Step 1: Write the failing test structure and setup**
Create the file with necessary imports, `beforeEach` database cleanup, and seeding logic.

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../db/client';
import { calculatePortfolioPerformance } from '../portfolioEngine';

describe('Performance Engine - Ground Truth Benchmark', () => {
    beforeEach(() => {
        db.exec('DELETE FROM holdings;');
        db.exec('DELETE FROM accounts;');
        db.exec('DELETE FROM price_history;');
        db.exec('DELETE FROM asset_registry WHERE ticker = "VTI";');
    });

    it('should accurately calculate 10% return and matching volatility for a linear price series', () => {
        // ... (empty body for now, or just expect(true).toBe(false) to watch it fail)
        expect(true).toBe(false);
    });
});
```

 - [x] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/logic/__tests__/performance_integrity.test.ts`
Expected: FAIL

 - [x] **Step 3: Implement database seeding**
Add logic to seed the account, holdings, asset registry, and exactly 252 days of price history (simulating 1 trading year).

```typescript
// Inside the 'it' block:
// 1. Seed Asset Registry & Portfolio
db.prepare("INSERT INTO asset_registry (ticker, canonical, description, asset_type, weights, is_core) VALUES ('VTI', 'Total Stock Market', 'Vanguard Total Stock Market', 'EQUITY', '{}', 1)").run();
db.prepare("INSERT INTO accounts (id, provider, tax_character) VALUES ('acc1', 'Test', 'TAXABLE')").run();
db.prepare("INSERT INTO holdings (account_id, ticker, quantity, asset_type) VALUES ('acc1', 'VTI', 100, 'EQUITY')").run();

// 2. Generate 252 days of linear prices ($100 -> $110)
const prices = [];
const dates = [];
const today = new Date();

for (let i = 251; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    dates.push(dateStr);
    
    // Linear growth from 100 to 110 over 252 days
    const price = 100 + (10 * (251 - i) / 251);
    prices.push(price);
    
    db.prepare("INSERT INTO price_history (ticker, date, close) VALUES ('VTI', ?, ?)").run(dateStr, price);
}
```

 - [x] **Step 4: Implement performance assertions**
Call the engine and assert against manually calculated ground truths.

```typescript
// 3. Call the engine
const result = calculatePortfolioPerformance();

// 4. Assert Returns
// The 1-year return should be exactly 10% (110 / 100) - 1
expect(result.return1y).toBeCloseTo(0.10, 5);
expect(result.totalPortfolioValue).toBeCloseTo(11000, 5); // 100 shares * $110

// 5. Calculate Expected Volatility Manually
const logReturns = [];
for (let i = 1; i < prices.length; i++) {
    logReturns.push(Math.log(prices[i] / prices[i - 1]));
}
const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
const variance = logReturns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / logReturns.length;
const expectedVol = Math.sqrt(variance * 252);

// Assert Volatility
expect(result.annualizedVol).toBeCloseTo(expectedVol, 5);
```

 - [x] **Step 5: Run test to verify it passes**
Run: `npx vitest run src/lib/logic/__tests__/performance_integrity.test.ts`
Expected: PASS

 - [x] **Step 6: Commit**
```bash
git add src/lib/logic/__tests__/performance_integrity.test.ts
git commit -m "test: add ground truth benchmark for portfolio performance engine"
```
