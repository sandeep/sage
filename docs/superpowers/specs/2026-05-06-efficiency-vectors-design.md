# Design: High-Reliability Visual Vectors

## Overview
This design implements visual crosshairs (vectors) that appear on hover in the Efficiency Map. These vectors visually decompose the "Efficiency Gap" into its two components: **Return Drag (ΔY)** and **Risk Excess (ΔX)**.

## Core Interaction (Option 1: Strict Anchoring)
When a user hovers over any point in the chart (Actual Portfolio, Snapshot, or Simulated Portfolio), the following vectors are drawn:

1.  **Delta Y (Vertical - Amber):** A vertical dashed line connecting the **hovered point** to its **Efficient Frontier ceiling** at the same volatility level.
2.  **Delta X (Horizontal - Rose):** A horizontal dashed line connecting the **Strategy Target (Ideal)** risk level to the **hovered point**.

## Technical Strategy
The previous attempts failed due to SVG occlusion (Z-index collision with 2,000+ points) and unreliable event firing. This design solves these issues with:

### 1. High-Priority Rendering Layer
Instead of `ReferenceLine` (which Recharts often renders below main data), we use a specialized **Top-Layer Scatter** with:
- `line` property enabled.
- `shape={() => null}` to hide coordinates.
- Positioned as the **absolute last child** of the Chart component.
- `pointer-events: none` to prevent the lines from stealing focus from the points.

### 2. Event Filtering
We use the chart-level `onMouseMove` event to capture the `activePayload`. To prevent "visual noise" from the frontier lines themselves:
- Vectors **ONLY** fire if the hovered point is a Portfolio, Snapshot, or Simulated Point.
- Vectors are **EXPLICITLY DISABLED** when hovering over the Frontier Curve or Global Ceiling lines.

### 3. State Management
- `hoveredPoint`: Stores the current payload.
- `isHovering`: A boolean gate to prevent flickering during rapid movement.

## Visual Specs
- **Return Drag (ΔY):** `#f59e0b` (Amber-500), Dashed (6,6), 3px width.
- **Risk Excess (ΔX):** `#f43f5e` (Rose-500), Dashed (6,6), 3px width.

## Success Criteria
- [ ] Hovering over "Portfolio (Actual)" shows two dashed lines forming a gap against the target.
- [ ] Hovering over any dot in the Emerald cloud shows the specific drag for that permutation.
- [ ] Lines are physically rendered on top of the cloud (verified via Playwright).
- [ ] No lines appear when hovering over the empty chart background.
