# Design Spec: Crisis Simulation Hardening (Resilience Audit)

## Goal
Ensure the 'Resilience Audit' is 100% populated with real historical data for every major market crash.

## Logic Requirements
1. **Definitive Mapping:**
   - Harden the 'simbaEngine.ts' mapping layer.
   - Every category in the database (e.g., 'Intl\'l Stock') MUST map to a Simba key.
2. **Expanded Time Horizon:**
   - Force the comparison engine to use a strict window of **1966-2026**.
   - Ensure the following events are explicitly indexed: '73 Oil Crisis, '87 Black Monday, '00 DotCom, '08 GFC, '20 COVID.
3. **Intra-Year Shock Overlays:**
   - Integrate 'Black Monday' (-33.0%) and '2020 COVID' (-34.0%) peak-to-trough markers as **discrete event overlays**.
   - These markers MUST be rendered as specific callouts in the UI and NOT modify the underlying annual return series used for CAGR calculations.

## UI Integration
- Component: `CrisisStressTableV2.tsx`
- Metrics: Show VTI vs Actual vs Strategy for every crisis event.
