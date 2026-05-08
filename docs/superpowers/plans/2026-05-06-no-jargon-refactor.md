# No-Jargon IA & Terminology Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify "Wrong Asset Mix" terminology across the dashboard and add explicit timeframe context (12M vs 50Y) to resolve user confusion between different drag metrics.

**Architecture:** Update UI components and section headers to use simplified, timeframe-qualified language. Update the "Strategic Verdict" logic to explain the delta between short-term drift and long-term potential.

**Tech Stack:** React, Next.js, Tailwind CSS.

---

### Task 1: Update Performance Bridge (Last 12 Months)

**Files:**
- Modify: `src/app/passive/PerformanceBridgeV2.tsx`
- Modify: `src/app/passive/PerformanceWaterfallClientV2.tsx`

- [ ] **Step 1: Update Bridge Header**
  Change the header in `PerformanceBridgeV2.tsx` to include the explicit 12-month context.

```tsx
// src/app/passive/PerformanceBridgeV2.tsx
<h2 className="text-ui-header text-white">Performance Bridge (Last 12 Months)</h2>
```

- [ ] **Step 2: Update Waterfall Label**
  Update the "Wrong Asset Mix" label in `PerformanceWaterfallClientV2.tsx` to include `(Today)`.

```tsx
// src/app/passive/PerformanceWaterfallClientV2.tsx
// In the 'items' array:
{ label: 'Wrong Asset Mix (Today)', val: driftDrag, dollars: driftDollars, type: 'drag', color: 'risk' },
```

- [ ] **Step 3: Commit Task 1**

```bash
git add src/app/passive/PerformanceBridgeV2.tsx src/app/passive/PerformanceWaterfallClientV2.tsx
git commit -m "ui: update Performance Bridge labels with (Today) and 12-month context"
```

---

### Task 2: Update Efficient Frontier (50-Year Average)

**Files:**
- Modify: `src/app/passive/EfficiencyMapClientV2.tsx`
- Modify: `src/app/passive/EfficiencyMapV2.tsx`

- [ ] **Step 1: Update Frontier Header**
  Change the header in `EfficiencyMapV2.tsx` to include the 50-year context.

```tsx
// src/app/passive/EfficiencyMapV2.tsx
<h2>Efficient Frontier (50-Year Average)</h2>
```

- [ ] **Step 2: Update Diagnostic Label**
  Update the "Execution Error" label to "Wrong Asset Mix (Historical)".

```tsx
// src/app/passive/EfficiencyMapClientV2.tsx
<div className="ui-caption text-amber-500 font-bold uppercase tracking-widest text-[9px]">Wrong Asset Mix (Historical)</div>
```

- [ ] **Step 3: Update Context Copy**
  Update the explanatory paragraph for the historical mix error.

```tsx
// src/app/passive/EfficiencyMapClientV2.tsx
<p className="text-zinc-500 leading-relaxed italic text-[11px] pt-1 border-t border-zinc-900/50">
    The money you lose on average every year because your plan's percentages are mathematically imperfect.
</p>
```

- [ ] **Step 4: Commit Task 2**

```bash
git add src/app/passive/EfficiencyMapClientV2.tsx src/app/passive/EfficiencyMapV2.tsx
git commit -m "ui: update Efficient Frontier labels with (Historical) and 50-year context"
```

---

### Task 3: Implement Integrated Strategic Verdict

**Files:**
- Modify: `src/app/passive/EfficiencyMapClientV2.tsx`

- [ ] **Step 1: Pass 12M Drift to the Client component**
  (Note: Need to check if `actualReturn` vs `targetReturn` is sufficient or if we need the specific 1Y Drift value passed from the bridge).
  Update the `Props` and calculation to show the contrast.

- [ ] **Step 2: Rewrite Verdict Copy Logic**
  Update the copy to explain the gap between Today and History.

```tsx
// Logic inside EfficiencyMapClientV2
const historicalGap = Math.abs(Math.round((localCeiling - coordinates.actual.return) * 1000) / 10);
const todayGap = 4.9; // We will extract this from the props or audit report

// New Verdict UI Block
<p className="text-zinc-300 font-bold leading-snug text-[13px]">
    Your plan is mathematically solid (only **{historicalGap}%** historical gap), but you had a rough year (**{todayGap}%** actual gap). 
    <span className="block mt-2 text-zinc-500 font-normal italic">
        You aren't just 'weighted wrong'—you're currently being punished by specific market conditions.
    </span>
</p>
```

- [ ] **Step 3: Verify build and Commit**

```bash
npm run build
git add .
git commit -m "ui: implement integrated Strategic Verdict explaining 1Y vs 50Y delta"
```
