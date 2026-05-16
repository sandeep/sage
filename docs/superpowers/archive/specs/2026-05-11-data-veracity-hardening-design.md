# Strategic Spec: Data Veracity Hardening (Phase 4.1)

## 1. Vision
Transform Sage from a prototype reliant on "happy path" assumptions into an institutionally rigorous financial engine. Every calculation must be mathematically sound, every fallback must be explicit (or throw an error), and all data ingestion must be robust against schema drift.

## 2. The Core Vulnerabilities (Forensic Findings)
An exhaustive code investigator audit revealed several critical shortcuts taken during initial development:

### A. Mathematical Integrity Failures
1. **The 111% Composition Bug**: In `src/lib/data/refresh.ts`, the seed weights for `VTIVX` sum to 1.11. This inflates all backtest and allocation math.
2. **Statistical Sloppiness**: `src/lib/logic/performanceMetrics.ts` uses Population Standard Deviation instead of Sample Standard Deviation. It also lacks safeguards for negative growth factors in geometric means.

### B. Fragile Ingestion & Silent Fallbacks
1. **Silent Fallback to TSM**: In `refresh.ts`, unknown assets are silently assigned to "Total Stock Market" instead of being flagged as UNMAPPED.
2. **Date Ignorance**: `xray.ts` resolves values using the *latest* available price, even when querying historical states.
3. **Hardcoded Dates**: `referenceDates.ts` uses a hardcoded `TODAY_ANCHOR`, causing all "YTD" or rolling metrics to become progressively stale.
4. **Sloppy Proxy Mapping**: `simbaEngine.ts` maps complex sectors (like Healthcare) directly to Total Stock Market proxies, destroying correlation accuracy.

## 3. Remediation Architecture

**1. The Strict Math Protocol**: Update all statistical functions to use proper sample math (Bessel's correction). Introduce strict `sum === 1.0` validation for all ETF composition data before it is saved to the database.

**2. The Explicit Ingestion Protocol**: Remove the silent fallback in `discoverAssets`. Unmapped assets must remain unmapped and trigger the `hasUnmapped` flag on the dashboard so the user is forced to classify them.

**3. Temporal Integrity**: Replace the hardcoded `TODAY_ANCHOR` with dynamic date resolution (or a strictly controlled simulation date context). Ensure `resolveValue` looks up the price *as of* the requested date, not the latest date.

## 4. Execution Roadmap

This spec will be executed via a dedicated Implementation Plan (`docs/superpowers/plans/2026-05-11-data-veracity-hardening.md`) covering:
1. Mathematical Corrections (VTIVX, Statistics).
2. Temporal Fixes (Date Anchors, Price Resolution).
3. Ingestion Rigor (Removing silent fallbacks).
