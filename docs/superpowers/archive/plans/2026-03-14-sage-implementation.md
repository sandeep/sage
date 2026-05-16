# Sage (The Logic Wrapper) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Build a private, agentic "Logic Wrapper" for wealth management that prioritizes asset location and concentration risk using Next.js and SQLite.

**Architecture:** A Next.js (App Router) application using `better-sqlite3` for persistent performance tracking. The system features a "Truth Layer" for air-gapped data ingestion and an "Asset X-Ray" for fund decomposition, mirroring all active directives to local Markdown files.

**Tech Stack:** Next.js, SQLite (better-sqlite3), Tailwind CSS, Lucide React, Zod (for validation).

---

## Chunk 1: Project Scaffolding & Truth Layer ✅

**Goal:** Initialize the Next.js project and set up the SQLite database and CSV ingestion logic.

- [x] **Task 1: Initialize Next.js Project**
- [x] **Task 2: SQLite Schema & Database Client**
- [x] **Task 3: CSV Ingestion Engine (Fidelity/Schwab)**

---

## Chunk 2: Asset X-Ray (Functional Composition) ✅

**Goal:** Implement the logic to "crack open" ETFs and calculate true security concentration.

- [x] **Task 4: ETF Look-Through Logic**

---

## Chunk 3: Alpha Engine Analyst ✅

**Goal:** Implement risk-adjusted performance metrics for the Alpha portfolio.

- [x] **Task 5: Performance & Risk Ratios**

---

## Chunk 4: Agentic Blotter & Text Sync ✅

**Goal:** Build the Next.js UI and the Markdown mirroring system for directives.

- [x] **Task 6: Directive Mirroring (Markdown Sync)**
- [x] **Task 7: The Blotter Interface (Next.js Dashboard)**
- [x] **Task 8: Account Architect (Mapping UI)**
