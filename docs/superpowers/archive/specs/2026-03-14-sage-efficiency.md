# Design Spec: Portfolio Efficiency & Drag (PE&D)
**Date:** 2026-03-14
**Module:** Phase 3 - Advanced Orchestration

## 1. Executive Summary
This module extends Sage from a "rebalancer" to an "efficiency analyst." It focuses on identifying and eliminating portfolio leakage (tax and expense drag) and providing agentic commentary on high-risk concentration and macro sentiment using Finnhub, FMP, and Yahoo Finance.

## 2. Success Criteria
- **Quantified Drag:** Literal BPS (Basis Point) cost provided for Tax Location and Fund Expenses.
- **Sentiment Awareness:** Large positions (Concentration Risk) are overlaid with news sentiment and earnings transcript summaries.
- **Tail Hedge Clarity:** Daily burn rate (theta) and downside efficiency metrics for QQQ rolling puts.

## 3. Technical Stack (Additions)
- **APIs:** Finnhub (Sentiment), FMP (Earnings Transcripts), Yahoo Finance (Yields/ER).
- **AI:** Local Gemini Nano for qualitative summarization.
- **Logic:** `src/lib/logic/efficiency.ts`.

## 4. Implementation Phase
1. **Data Layer:** Enhance `prices.json` and `holdings` table to include yields and expense ratios.
2. **Logic Layer:** Implement drag calculations and sentiment matching.
3. **UI Layer:** "Efficiency" tab and "Agentic Commentary" cards.
