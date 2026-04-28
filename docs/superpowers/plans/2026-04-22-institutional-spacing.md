# Institutional Spacing & IA Hardening Plan

**Goal:** Establish a unified visual rhythm across the Performance page using a standardized spacing scale (32 / 12 / 6) and finalize the de-duplicated forensic layout.

---

## 1. Unified Spacing Scale (The Design Token)

| Level | Tailwind Class | Physical Pixel | Use Case |
| :--- | :--- | :--- | :--- |
| **Major** | `space-y-32` | 128px | Gap between top-level analytical sections. |
| **Section** | `space-y-12` | 48px | Gap between Title/Subtitle and the Data component. |
| **Widget** | `space-y-6` | 24px | Gap between internal card elements and text blocks. |

---

## 2. Implementation Tasks

### Task 1: Main Layout Normalization
**Files:** `src/app/performance/page.tsx`
*   Set the `page-container` to **`space-y-32`**.
*   Remove all `space-y-48` and `pt-48` overrides.
*   Ensure all section wrappers use consistent **`space-y-12`**.

### Task 2: Component Rhythm Audit
**Files:** 
- `src/app/performance/PerformanceGridV2.tsx`
- `src/app/performance/StructuralCostCenter.tsx`
- `src/app/performance/ResilienceAuditV2.tsx`

*   Update all root sections to **`space-y-12`**.
*   Update internal card grids to **`space-y-6`**.

### Task 3: Final Verification (Next.js MCP)
*   Run `get_errors` to ensure no JSX breakage.
*   Perform a visual regression check via screenshot.

---

**Shall I proceed with this "Standardized Grid" implementation?** I will wait for your confirmation to execute.
