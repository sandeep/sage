# Dashboard UX & Risk Redesign (Updated)

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Enhance the existing hierarchical MetricTable with a Stock Hover UI, replace the redundant Allocation DNA widget with an actionable Risk widget, and support custom Expense Ratios for Institutional Trusts.

---

## 1. Stock Hover UI (Integrated into MetricTable)

**Problem:** To see which accounts hold a specific ticker, users currently have to navigate to a separate page.

**Solution:** A custom, dark-themed tooltip triggered by hovering over any ticker row inside the existing, hierarchical `MetricTable` on the main dashboard.

**Tooltip Content:**
1.  **Header:** Ticker, Canonical Name, Total Value, Total Shares.
2.  **Pricing Strip:** Current Price, 52-Week Low, 52-Week High.
3.  **Metadata Strip:** Yield and Expense Ratio.
4.  **Account Breakdown:** A list of exactly which accounts hold this ticker and the dollar value in each.

**Implementation:**
*   Requires enriching the dashboard data fetch (`calculateHierarchicalMetrics` in `xray.ts`) to join `holdings` with `accounts` and `price_history` per ticker so the tooltip has all required data.
*   Tooltip will be absolutely positioned relative to the row to avoid clipping.

---

## 2. Risk & Concentration Widget

**Problem:** The "Allocation DNA" widget is redundant, as it duplicates the aggregation already happening in the target allocation tree. 

**Solution:** Replace it with an actionable **Risk & Concentration** sidebar widget focusing on uncompensated risks.

**Features:**
1.  **Single-Stock Concentration:** Highlights individual companies (e.g., AAPL, AMZN) that exceed a certain threshold (e.g., >5% of the total portfolio).
2.  **Actionable Expense Drags:** Identifies holdings with high ERs *only* when a better, cheaper alternative already exists in the user's available universe (e.g., holding a 0.50% ER fund in an IRA when a 0.03% equivalent is allowed in their 401k).

---

## 3. Institutional Trust ER Tracking

**Problem:** Institutional Trusts (CITs) like Vanguard's `Instl 500 Index Trust` lack public tickers. We map them to proxies (like `VIIIX`) to fetch daily prices, but the proxy's ER (e.g., 0.02%) often differs from the actual CIT's ER (e.g., 0.01%). We need to track the actual ER to correctly calculate the portfolio's expense drag and evaluate alternatives.

**Solution:** 
1.  Update the `asset_registry` database schema to include a nullable `custom_er` column.
2.  When the CSV parser intercepts a CIT and assigns a proxy ticker (like `VIIIX`), it will also log the proxy relationship.
3.  We will provide a way (either via a config file or UI) to hardcode the `custom_er` for specific institutional proxy overrides.
4.  Update the Efficiency Engine (`src/lib/logic/efficiency.ts`) to use `asset_registry.custom_er` if it exists, falling back to `ticker_meta.er` only for standard public tickers.

---

## Files Changed

| File | Action |
|---|---|
| `src/app/page.tsx` | Remove Allocation DNA, add RiskWidget. |
| `src/app/components/MetricTable.tsx` | Implement Stock Hover UI on instrument rows. |
| `src/app/components/RiskWidget.tsx` | New component replacing AssetXRay. |
| `src/lib/logic/xray.ts` | Update data fetching for hover data enrichment. |
| `src/lib/logic/efficiency.ts` | Support `custom_er` logic for Institutional Trusts. |
| `src/lib/db/schema.sql` / `migrate.ts` | Add `custom_er` to `asset_registry`. |
