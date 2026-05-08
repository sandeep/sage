# Design Spec: High-Reliability Visual Vectors & Typography

## Overview
This spec documents the final, high-integrity implementation of the interactive Efficiency Map on the `/passive` page. It resolves issues regarding SVG occlusion (invisible lines) and typographic noise.

## 1. Visual Vectors (Interactive De-composition)
To visually explain the "Efficiency Gap," the chart draws two dynamic vectors when any portfolio or snapshot is hovered.

### Technical Implementation: Top-Layer Scattering
Standard `ReferenceLine` components were physically blocked by the dense 2,000+ dot opportunity cloud. The final solution uses **Dedicated Scatter Components** as the final children of the chart:
- **Properties:** `line` enabled, `shape={() => null}`, `pointer-events: none`.
- **Vertical Amber Vector (ΔY):** Connects the hovered point straight up to the **Local Portfolio Ceiling** at the same risk level.
- **Horizontal Rose Vector (ΔX):** Connects the **Strategy Target (Ideal)** risk level horizontally to the hovered point.

## 2. Typography Rationalization
The section was rationalized to match the Sage Design System (`globals.css`), eliminating arbitrary font sizes and weights.

### Modular Scale Alignment
- **Headers:** `ui-header` (18px, Bold).
- **Primary Labels:** `ui-label` (11px, Bold, Uppercase, 0.15em Tracking).
- **Secondary Metadata:** `ui-caption` (10px, Regular, Uppercase, 0.1em Tracking).
- **Explanatory Copy:** `ui-body` (13px, Regular, Normal Case).
- **Large Metrics:** `ui-metric` (20px, Bold, Tabular).

### Treatment Constraints
- Removed all `italic` and non-standard `text-[11px]` styles.
- Removed arbitrary borders to rely on whitespace for grouping.
- Replaced "Execution Error" jargon with **"Wrong Asset Mix (Historical)"** to unify the mental model with the Performance Bridge.

## 3. Integrated Strategic Verdict
A new narrative-driven block connects short-term reality with long-term potential:
- **Logic:** Compares the 12-month `driftDrag` against the 50-year `executionError`.
- **Narrative:** *"Your plan is mathematically strong (only [X]% historical gap), but you had a rough year ([Y]% actual gap)."*
