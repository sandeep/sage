This PR resolves a series of cascading build failures and regressions discovered during the triage of Issues #1 and #4.

**Fixes Included:**
- **Issue #1 (Crisis Simulation):** Correctly computes and displays peak-to-trough drawdowns for all crisis regimes.
- **Issue #4 (Chart Dimension):** Resolves Recharts dimension errors on the `/active` page.
- **Issues #5-14 (Build Stabilization):** Systematically debugged and fixed a series of pre-existing and newly-discovered build errors, including:
  - Removed orphaned Monte Carlo components.
  - Restored missing comparison engine exports.
  - Corrected multiple TypeScript type mismatches across the application.

All changes have been tested and the build is now stable.