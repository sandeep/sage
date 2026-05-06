// src/lib/logic/dashboardService.ts
import db from '../db/client';
import { calculateHierarchicalMetrics } from './xray';
import { getConcentrationRisks, getExpenseRisks } from './xray_risks';
import { generateDirectives, Directive, PersistedDirective } from './rebalancer';
import { calculatePortfolioEfficiency } from './efficiency';
import { getStrategyEvolution } from './strategyEvolution';

export async function getDashboardData() {
  await generateDirectives();
  
  const hierarchicalMetrics = calculateHierarchicalMetrics();
  const concentrationRisks = getConcentrationRisks();
  const expenseRisks = getExpenseRisks();
  const efficiency = calculatePortfolioEfficiency();
  const evolution = getStrategyEvolution();
  
  const allDirectives = db.prepare("SELECT * FROM directives").all() as PersistedDirective[];

  // Fetch Topology Data for Forensic Sankey
  const accounts = db.prepare('SELECT id, nickname as name FROM accounts').all() as any[];
  const holdings = db.prepare(`
      SELECT h.account_id, h.ticker, SUM(h.market_value) as value, COALESCE(ar.asset_type, 'UNKNOWN') as asset_type
      FROM holdings h
      LEFT JOIN asset_registry ar ON h.ticker = ar.ticker
      GROUP BY h.account_id, h.ticker
  `).all() as any[];

  const nodes: any[] = [];
  const links: any[] = [];
  const nodeMap = new Map<string, any>();

  accounts.forEach(acc => {
      const node = {
          id: String(acc.id),
          name: acc.name || acc.id,
          type: 'account',
          totalValue: 0
      };
      nodes.push(node);
      nodeMap.set(String(acc.id), node);
  });

  holdings.forEach(h => {
      const accountId = String(h.account_id);
      const accountNode = nodeMap.get(accountId);
      if (accountNode) {
          accountNode.totalValue += (h.value || 0);
      }

      if (!nodeMap.has(h.ticker)) {
          const tickerNode = {
              id: h.ticker,
              name: h.ticker,
              type: 'ticker',
              assetType: h.asset_type,
              totalValue: 0
          };
          nodes.push(tickerNode);
          nodeMap.set(h.ticker, tickerNode);
      }
      
      const tickerNode = nodeMap.get(h.ticker);
      tickerNode.totalValue += (h.value || 0);

      links.push({
          source: accountId,
          target: h.ticker,
          value: h.value || 0,
          assetType: h.asset_type
      });
  });

  const firstSharpe = evolution.length > 0 ? evolution[0].sharpeRatio : 0;
  const currentSharpe = evolution.length > 0 ? evolution[evolution.length - 1].sharpeRatio : 0;
  const alphaScore = currentSharpe - firstSharpe;

  // Count holdings with no price data
  const unpricedCount = db.prepare(`
      SELECT COUNT(DISTINCT h.ticker) as c
      FROM holdings h
      LEFT JOIN (
          SELECT ticker, MAX(date) as latest FROM price_history GROUP BY ticker
      ) ph ON h.ticker = ph.ticker
      WHERE (h.market_value IS NULL OR h.market_value = 0) AND ph.ticker IS NULL
  `).get() as { c: number };

  const unmappedCount = db.prepare(`
      SELECT COUNT(DISTINCT h.ticker) as c
      FROM holdings h
      LEFT JOIN asset_registry ar ON h.ticker = ar.ticker
      WHERE ar.ticker IS NULL
  `).get() as { c: number };

  // Check if any held tickers are ETFs/funds with no composition data
  const heldFunds = db.prepare(`
      SELECT COUNT(*) as n FROM holdings h
      JOIN asset_registry ar ON h.ticker = ar.ticker
      WHERE ar.asset_type IN ('ETF', 'FUND', 'MUTUAL_FUND')
  `).get() as { n: number };

  const hasEtfComposition = db.prepare(`SELECT COUNT(*) as n FROM etf_composition`).get() as { n: number };
  const hasEtfHoldings = heldFunds.n > 0 && hasEtfComposition.n === 0;

  return {
    hierarchicalMetrics,
    concentrationRisks,
    expenseRisks,
    efficiency,
    evolution,
    allDirectives,
    nodes,
    links,
    alphaScore,
    unpricedCount: unpricedCount.c,
    unmappedCount: unmappedCount.c,
    hasEtfHoldings
  };
}
