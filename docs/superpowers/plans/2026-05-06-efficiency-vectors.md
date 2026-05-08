# High-Reliability Visual Vectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement visual ΔX (Risk) and ΔY (Return) vectors on the Efficiency Map that respond reliably to hover events.

**Architecture:** Use a chart-level `onMouseMove` event to capture the hovered payload and render the vectors using a dedicated, top-layer `Scatter` component with the `line` property enabled to bypass Z-index occlusion.

**Tech Stack:** React, Next.js, Recharts, Tailwind CSS.

---

### Task 1: Refactor Hover Logic and Payload Detection

**Files:**
- Modify: `src/app/passive/EfficiencyMapClientV2.tsx`

- [ ] **Step 1: Implement robust onMouseMove handler**
  Update the `ScatterChart` onMouseMove to filter for interactive points and update local state.

```tsx
// Inside EfficiencyMapClientV2 component
const [hoveredPoint, setHoveredPoint] = useState<any>(null);

// ... inside ScatterChart props
onMouseMove={(e: any) => {
    if (e && e.activePayload && e.activePayload.length > 0) {
        const p = e.activePayload[0].payload;
        // Only trigger for portfolios, snapshots, or simulated points (the cloud)
        // Explicitly ignore the frontier ceiling lines
        if (!p.isCurve && !p.isGlobal) {
            setHoveredPoint(p);
        } else {
            setHoveredPoint(null);
        }
    } else {
        setHoveredPoint(null);
    }
}}
onMouseLeave={() => setHoveredPoint(null)}
```

- [ ] **Step 2: Commit refactor**

```bash
git add src/app/passive/EfficiencyMapClientV2.tsx
git commit -m "feat: implement filtered hover state for chart vectors"
```

### Task 2: Implement High-Reliability Top-Layer Vectors

**Files:**
- Modify: `src/app/passive/EfficiencyMapClientV2.tsx`

- [ ] **Step 1: Add the Vector Scatters as final children of the chart**
  Use the `line` property on `Scatter` components to draw the ΔX and ΔY vectors. This ensures they are rendered on the top layer.

```tsx
// At the very bottom of ScatterChart children, after all other Scatters
{hoveredPoint && (
    <>
        {/* Delta Y: Vertical line from point to frontier ceiling */}
        <Scatter
            name="Return Vector (ΔY)"
            isAnimationActive={false}
            data={[
                { vol: hoveredPoint.vol, return: hoveredPoint.return },
                { vol: hoveredPoint.vol, return: findOptimalReturnAtRisk(frontierPoints.points, hoveredPoint.vol) }
            ]}
            line={{ stroke: '#f59e0b', strokeWidth: 3, strokeDasharray: '6 6' }}
            shape={() => null}
            style={{ pointerEvents: 'none' }}
        />
        {/* Delta X: Horizontal line from target/ideal to point */}
        <Scatter
            name="Risk Vector (ΔX)"
            isAnimationActive={false}
            data={[
                { vol: coordinates.target.vol, return: hoveredPoint.return },
                { vol: hoveredPoint.vol, return: hoveredPoint.return }
            ]}
            line={{ stroke: '#f43f5e', strokeWidth: 3, strokeDasharray: '6 6' }}
            shape={() => null}
            style={{ pointerEvents: 'none' }}
        />
    </>
)}
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: SUCCESS

- [ ] **Step 3: Commit implementation**

```bash
git add src/app/passive/EfficiencyMapClientV2.tsx
git commit -m "feat: render visual vectors on top-most SVG layer"
```

### Task 3: Empirical UI Verification

**Files:**
- Modify: `src/app/passive/EfficiencyMapClientV2.tsx` (if needed for final polish)

- [ ] **Step 1: Verify vectors are physically present in the DOM on hover**
  Use Playwright to simulate hover and check for path elements with the specific vector colors.

```javascript
// Test script (conceptual)
const actualDot = await page.locator('path[fill="#fb7185"]');
await actualDot.hover();
const amberVector = await page.locator('path[stroke="#f59e0b"]');
const roseVector = await page.locator('path[stroke="#f43f5e"]');
await expect(amberVector).toBeVisible();
await expect(roseVector).toBeVisible();
```

- [ ] **Step 2: Remove any residual debug logging**
  Ensure any console.logs added during debugging are removed before finishing.

- [ ] **Step 3: Final commit**

```bash
git commit -am "chore: final verification and cleanup of efficiency vectors"
```
