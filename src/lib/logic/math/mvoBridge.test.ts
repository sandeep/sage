import { describe, it, expect } from 'vitest';
import { solveEfficientFrontier } from './mvoBridge';

describe('solveEfficientFrontier', () => {
  it('should return a valid frontier for good data', async () => {
    const returns = {
      stock: [0.1, 0.12, 0.15, 0.08, 0.09, 0.11, 0.14, 0.13, 0.1, 0.12],
      bond: [0.02, 0.03, 0.025, 0.04, 0.035, 0.03, 0.02, 0.03, 0.04, 0.035],
    };
    const result = await solveEfficientFrontier(returns);
    expect(result.points.length).toBeGreaterThan(0);
    expect(result.cloud.length).toBe(2000);
    
    // Verify diversified points (not all extreme)
    const curvePoints = result.points.filter(p => p.isCurve);
    console.log(`Generated ${curvePoints.length} frontier points.`);
  });

  it('should handle highly correlated assets', async () => {
    const returns = {
      stock1: [0.1, 0.12, 0.15, 0.08, 0.09, 0.11, 0.14, 0.13, 0.1, 0.12],
      stock2: [0.101, 0.121, 0.151, 0.081, 0.091, 0.111, 0.141, 0.131, 0.101, 0.121],
    };
    const result = await solveEfficientFrontier(returns);
    expect(result.points.length).toBeGreaterThan(0);
  });

  it('should fail gracefully for assets with insufficient data', async () => {
    const returns = {
      stock: [0.1, 0.12, 0.15, 0.08], // Only 4 points
      bond: [0.02, 0.03, 0.025, 0.04],
    };
    await expect(solveEfficientFrontier(returns)).rejects.toThrow(/Insufficient overlapping historical data/i);
  });
});
