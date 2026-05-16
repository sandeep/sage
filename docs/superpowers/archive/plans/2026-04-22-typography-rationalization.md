# Typography Rationalization & Design System Plan

**Goal:** Standardize the Performance suite on a strict 5-tier typography scale and purge all non-standard font sizes (8px, 9px, text-xl).

---

## 1. The 5-Tier Scale (The Rules)

| Tier | Tailwind Token | Physical Size | Mapping Use Cases |
| :--- | :--- | :--- | :--- |
| **01. HERO** | `text-ui-data` | **20px** | Big returns, Total dollar losses, Bridge metrics. |
| **02. HEADER**| `text-ui-header` | **18px** | Major section headlines only. |
| **03. BODY** | `text-ui-body` | **13px** | Primary table rows, Verdict text, Body copy. |
| **04. LABEL** | `text-ui-label` | **11px** | Column headers, Navigation, Secondary detail. |
| **05. META** | `text-ui-caption`| **10px** | **MINIMUM SIZE.** Proxy badges, Bps detail, Small tags. |

---

## 2. Implementation Tasks

### Task 1: Performance Grid Normalization
**Files:** `src/app/performance/PerformanceGridClientV2.tsx`
*   Change physical dollars from `text-[9px]` to `text-ui-caption`.
*   Change proxy badges from `text-[8px]` to `text-ui-caption`.
*   Maintain `font-black` for realization and `font-medium` for proxies.

### Task 2: Cost Center Harmonization
**Files:** `src/app/performance/StructuralCostCenter.tsx`
*   Replace `text-xl` with `text-ui-data` for the annualized leakage metrics.
*   Update detail list items to use `text-ui-label` (11px).
*   Ensure all Bps labels are `text-ui-caption` (10px).

### Task 3: Forensic Engine Badging
**Files:** `src/app/performance/ResilienceAuditV2.tsx` (and other badged items)
*   Change "EXPERIMENTAL" and "DATA GAP" tags from `text-[9px]` to `text-ui-caption`.
*   Normalize internal spacing using the 6px token (`gap-2`).

---

**Does this 5-Tier Typography Plan meet your requirements?** I will wait for your confirmation to execute.
