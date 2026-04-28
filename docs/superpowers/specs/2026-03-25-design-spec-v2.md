# Design Specification: Sage Institutional IA v2.1

## 1. Goal: Radical Simplification
Align the Performance page with the high-density, flat-canvas Dashboard. Eliminate all repeated labels, redundant component headers, and unnecessary nesting.

## 2. Typographic Standard (JetBrains Mono Only)
- **H2 (Section Header):** `ui-hero` (40px, 800, Italic). Used only in the page layout.
- **Data Headers:** `ui-label` (11px, 700). Used for table columns and grid labels.
- **Data Results:** `ui-metric` (20px, 700). Used for primary numeric results.
- **Narrative:** `ui-value` (13px, 500). Used for analytical takeaways.

## 3. Structural Mandates
- **Remove Component Headers:** `ComparisonPanel`, `SuccessFunnel`, `PerformanceFrontier`, and `CrisisStressTable` must have their internal `<h2 />` and header divs deleted.
- **Flat Architecture:** Sections should be separated by standard `<section className="space-y-12 border-t border-zinc-900 pt-24">` tags in the page layout, not by internal component borders.
- **Color Signifiers:**
  - **White:** Historical Reality.
  - **Emerald:** Strategy Potential / Success.
  - **Rose:** Immediate Risk / Drift Loss.

## 4. Section Consolidation Map
1. **Performance Audit:** Traling returns grid.
2. **Efficiency Map:** Scatter chart + Sidebar. (Internal "Efficiency Map" title deleted).
3. **Performance Bridge:** Waterfall. (Internal "Performance Bridge" title deleted).
4. **Variance Ledger:** Drift table. (New H2 in page layout).
5. **Structural Optimization:** Tax/Fee targets. (Differentiates from Strategy Optimization).
6. **Resilience Audit:** 5-column crisis table. (Replaces all "Stress Test" variants).
7. **Success Probability:** Monte Carlo funnel.
