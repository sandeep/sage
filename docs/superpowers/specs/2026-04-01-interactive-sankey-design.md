# Design Spec: Interactive Forensic Sankey (Capital Flow)

## Purpose
Elevate the portfolio visualization from a static table to an interactive "First Class Citizen" that shows exactly how capital flows from accounts to specific instruments, with high-integrity reconciliation.

## UI/UX Design
- **Location:** Permanent section on the Dashboard below the "Exposure Audit".
- **Architecture:** 2-Tier Sankey (D3-Sankey).
    - **Left Nodes:** Accounts (Source of funds).
    - **Right Nodes:** Tickers (Destinations).
- **Color Mapping (by Asset Class):**
    - `EQUITY`: Emerald-500 (#10b981)
    - `BOND`/`FIXED_INCOME`: Amber-500 (#f59e0b)
    - `CASH`: Blue-500 (#3b82f6)
    - `OPTION`: Indigo-500 (#6366f1)
- **Labeling Strategy:**
    - **Accounts:** Name + Total Balance (Left-aligned, positioned to the left of the bar).
    - **Tickers:**
        - **Contribution Label:** The $ amount flowing from the *selected* account (Visible only on click, positioned to the left of the bar).
        - **Identity Label:** Ticker Symbol (Right-aligned, positioned to the right of the bar).
        - **Global Total Label:** Total $ value of ticker across all accounts (Right-aligned, positioned to the right of the bar).

## Interactivity (The "Forensic Drill-down")
- **Default State:** All links visible at 20% opacity. Ticker labels show global totals.
- **Click Account:**
    - Highlight only the links originating from that account (80% opacity).
    - Dim all other accounts and links (5% opacity).
    - **Reconciliation Footer:** Slide in a panel showing:
        - `Account Target Balance`: The total reported by the source.
        - `Sum of Links`: The sum of the individual holdings detected.
        - `Integrity Check`: Color-coded status (Emerald if matched within $0.01).
- **Reset:** A "Reset View" button to return to the global portfolio view.

## Data Requirements
- **Endpoint:** `/api/portfolio/topology` (New or updated `/api/refresh`)
- **Schema:**
    - `nodes`: `Array<{ id: string, name: string, type: 'account' | 'ticker', assetType?: string, totalValue: number }>`
    - `links`: `Array<{ source: string, target: string, value: number, assetType: string }>`

## Implementation Steps
1. Create `src/app/components/ForensicSankey.tsx` using D3-Sankey.
2. Update `src/app/api/upload/route.ts` to provide the required 2-tier data structure.
3. Integrate into `src/app/page.tsx` as a permanent section.
