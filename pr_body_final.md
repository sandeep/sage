## Summary
This PR implements a comprehensive **Strategic Efficiency Diagnostic** and rationalizes the typography hierarchy across the `/passive` page. It resolves critical visual occlusion issues in the Efficient Frontier chart and unifies terminology to reduce user cognitive load.

### Key Changes
- **High-Reliability Visual Vectors:** Implemented interactive ΔX (Risk) and ΔY (Return) vectors using a Top-Layer Scatter strategy, ensuring they are always visible over the dense opportunity cloud.
- **Typography Rationalization:** Aligned all UI elements with the **Sage Design System** (10px / 11px / 13px / 18px / 20px modular scale). Purged non-standard font sizes, weights, and treatments (italics, redundant borders).
- **No-Jargon Terminology:** Unified 'Execution Error' and 'Drift' into **"Wrong Asset Mix"**, explicitly qualified by timeframe: **(Today)** for 1Y Actual and **(Historical)** for 50Y Average.
- **Integrated Strategic Verdict:** Added a narrative-driven block that dynamically explains the delta between short-term market punishment and long-term mathematical potential.

### Technical Implementation
- Switched from `ReferenceLine` to dedicated `Scatter` components with `line` enabled for top-layer SVG rendering.
- Refactored hover triggers to point-level `onMouseEnter` for high-density interaction reliability.
- Updated `auditEngine.ts` and `EfficiencyMapV2.tsx` to handle dual-frontier calculations and dynamic drift passing.

### Verification
- [x] `npm run build` verified with zero type errors.
- [x] Visual verification of vectors and typography on port 3333.
- [x] Purged all debug artifacts (`dump_audit.js`, `debug-frontier` API).
