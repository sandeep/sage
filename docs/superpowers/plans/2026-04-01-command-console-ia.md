# Command Console IA & Dashboard Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a persistent sidebar with a Portfolio/Alpha console switcher, consolidate dashboard views, and move data ingestion to a contextual modal.

**Architecture:** 
- `WorkspaceContext`: Client-side state for active console.
- `Sidebar`: Global navigation component with console segmented control.
- `SyncModal`: Context-aware 2-step ingestion pipeline.
- Consolidated `src/app/page.tsx` (Portfolio Overview).

**Tech Stack:** React, Next.js, TailwindCSS, D3-Sankey.

---

### Task 1: Global Workspace Context

**Files:**
- Create: `src/app/components/WorkspaceContext.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Implement Workspace Provider**
Create a context to track `activeConsole` ('portfolio' | 'alpha').
```typescript
'use client';
import React, { createContext, useContext, useState } from 'react';

type Console = 'portfolio' | 'alpha';
const WorkspaceContext = createContext<{
    activeConsole: Console;
    setConsole: (c: Console) => void;
    isSyncOpen: boolean;
    setSyncOpen: (o: boolean) => void;
} | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
    const [activeConsole, setConsole] = useState<Console>('portfolio');
    const [isSyncOpen, setSyncOpen] = useState(false);
    return (
        <WorkspaceContext.Provider value={{ activeConsole, setConsole, isSyncOpen, setSyncOpen }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
    return context;
}
```

- [ ] **Step 2: Wrap Root Layout**
Wrap the application in the `WorkspaceProvider`.

- [ ] **Step 3: Commit**
```bash
git add src/app/components/WorkspaceContext.tsx src/app/layout.tsx
git commit -m "feat: add global workspace context for console management"
```

### Task 2: Console Sidebar & Header

**Files:**
- Create: `src/app/components/Sidebar/Sidebar.tsx`
- Create: `src/app/components/Sidebar/ConsoleSwitcher.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Implement Sidebar Component**
Build the persistent sidebar with grouped navigation links (Portfolio, Alpha, Settings) that react to the `activeConsole` state.

- [ ] **Step 2: Implement ConsoleSwitcher**
Build the segmented control at the top of the sidebar.

- [ ] **Step 3: Update Global Layout**
Remove the old `NavBar` and implement the Sidebar + Main Content flex layout.

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "feat: implement console sidebar and workspace switcher"
```

### Task 3: Contextual Sync Modal

**Files:**
- Create: `src/app/components/Ingest/SyncModal.tsx`
- Modify: `src/app/components/MainImporter.tsx` (Extract logic)

- [ ] **Step 1: Create SyncModal Wrapper**
Implement the overlay and modal frame. Use the logic from `MainImporter.tsx` but adapt it for the modal context.

- [ ] **Step 2: Implement Contextual Ingest UI**
If `activeConsole` is 'portfolio', show Fidelity dropzone. If 'alpha', show Robinhood dropzone.

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: implement context-aware 2-step sync modal"
```

### Task 4: Dashboard & Navigation Consolidation

**Files:**
- Modify: `src/app/page.tsx`
- Delete: `src/app/holdings/page.tsx`
- Delete: `src/app/rebalancer/page.tsx`

- [ ] **Step 1: Consolidate Portfolio Overview**
Ensure `src/app/page.tsx` includes Metrics, Sankey, and Rebalancer as sections. Remove the `MainImporter` from the permanent view.

- [ ] **Step 2: Cleanup redundant routes**
Remove pages that are now merged into the unified Overview.

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "refactor: consolidate holdings and rebalancer into unified overview"
```

### Task 5: Final Polish

- [ ] **Step 1: Normalize Spacing and Styles**
Ensure sidebar, header, and main content have perfect forensic alignment.

- [ ] **Step 2: Verify Build**
Run `npm run build`.
