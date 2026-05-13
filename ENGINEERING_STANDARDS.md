# Engineering Standards: Data Integrity & Mathematical Rigor

This document defines the mandatory engineering principles for maintaining the mathematical truth and security of the Sage performance engine.

## 1. Mathematical Defensive Programming
*   **NaN Protection**: All compounding or geometric functions (CAGR, Capture Ratios) must guard against negative bases. Use `Math.max(0, 1 + r)` for growth factors.
*   **Zero-Division Guard**: All ratios (Sharpe, Information, etc.) must explicitly handle cases where the denominator (standard deviation or tracking error) is zero, returning `0` or `null` instead of `Infinity`.
*   **Sample vs. Population**: Always use **Sample Standard Deviation** ($n-1$) for performance metrics unless explicitly documenting why a population calculation is required.

## 2. Floating Point Epsilon Discipline
*   **No Strict Float Equality**: Never use `===` for dollar amounts or weights. Use an epsilon threshold for comparisons: `if (Math.abs(a - b) < 1e-6)`.
*   **Sum Validation**: Any ingestion of asset compositions must run a sum-check against `1.0` (with a `0.001` tolerance) before reaching the database.

## 3. Absolute SQL Parameterization
*   **Template Literal Ban**: Prohibit string interpolation (`${var}`) inside `db.prepare()` or `db.exec()`. Only use `?` placeholders. This applies even to internal system strings to prevent "slop" from evolving into vulnerabilities.

## 4. Data Pipeline Observability
*   **No Silent Swallowing**: Empty `catch {}` blocks are prohibited in `src/lib/logic`. At minimum, errors must be logged with `console.warn` or `console.error` and include the identifier (ticker, account, or filename) being processed at the time of failure.

## 5. Explicit Ingestion (Zero Fallbacks)
*   **Fail-Open is Slop**: The ingestion engine must not make "best guess" assumptions about unmapped assets (e.g., defaulting unknown tickers to "Total Stock Market"). These must be tagged as `UNMAPPED` to force user classification, preserving the mathematical truth of the dashboard.

## 6. Database Portability & Dialect Safety
*   **Standard SQL**: Avoid vendor-specific SQL extensions where possible. Prioritize Standard SQL to ensure compatibility with future hosted providers (e.g., PostgreSQL).
*   **Agnostic Logic**: Business logic must not depend on the physical storage format. Maintain clear boundaries between data access layers and core financial calculations.
