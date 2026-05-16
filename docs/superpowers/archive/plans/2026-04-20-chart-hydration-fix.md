# Chart Hydration Stabilization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permanently eliminate the `width(-1)` console errors by ensuring charts only render after the browser has finalized the CSS layout.

**Architecture:** Implement the **Deferred Mounting Pattern** across all client-side charts. This uses a React `useEffect` to flip a `mounted` state, preventing Recharts from measuring dimensions during the server-side hydration gap.

---

### Task 1: Fix Efficiency Map Hydration

**Files:**
- Modify: `src/app/performance/EfficiencyMapClientV2.tsx`

- [ ] **Step 1: Implement Mounted Guard**

```typescript
// Replace the start of the component
export default function EfficiencyMapClientV2({ coordinates, snapshotTrail, frontierPoints }: Props) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <div className="xl:col-span-2 aspect-video min-h-[450px] bg-zinc-900/5 animate-pulse rounded-sm" />;
    }
    // ... rest of component
```

---

### Task 2: Fix Success Funnel Hydration

**Files:**
- Modify: `src/app/performance/SuccessFunnelClientV2.tsx`

- [ ] **Step 1: Implement Mounted Guard**

```typescript
// Add to component body
export default function SuccessFunnelClientV2({ initialValue }: Props) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <div className="xl:col-span-2 aspect-video min-h-[400px] bg-zinc-900/5 animate-pulse rounded-sm" />;
    }
    // ... rest of component
```

---

### Task 3: Fix Performance Frontier Hydration

**Files:**
- Modify: `src/app/components/PerformanceFrontier.tsx`

- [ ] **Step 1: Implement Mounted Guard**

```typescript
export default function PerformanceFrontier({ coordinates }: Props) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <div className="xl:col-span-2 aspect-video min-h-[450px] bg-zinc-900/5 animate-pulse rounded-sm" />;
    }
    // ... rest of component
```

---

### Task 4: Fix Allocation Drift Chart Hydration

**Files:**
- Modify: `src/app/components/AllocationDriftChart.tsx`

- [ ] **Step 1: Implement Mounted Guard**

```typescript
export default function AllocationDriftChart({ history }: { history: any[] }) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <div className="w-full h-[180px] bg-zinc-900/5 animate-pulse rounded-sm" />;
    }
```

---

### Task 5: Final Validation

- [ ] **Step 1: Verify Console Output**
Navigate to `/performance` and confirm the `width(-1)` error is gone.
