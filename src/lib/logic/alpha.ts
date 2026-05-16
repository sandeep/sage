// src/lib/logic/alpha.ts

export function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.05): number {
    if (returns.length === 0) return 0;
    
    const meanReturn = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.length < 2 ? 0 : returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    return (meanReturn - riskFreeRate) / stdDev;
}

export function calculateSortinoRatio(returns: number[], riskFreeRate: number = 0.05): number {
    if (returns.length === 0) return 0;
    
    const meanReturn = returns.reduce((a, b) => a + b) / returns.length;
    const downsideReturns = returns.filter(r => r < riskFreeRate);
    
    if (downsideReturns.length === 0) return 0;
    
    const downsideVariance = downsideReturns.length < 2 ? 0 : downsideReturns.reduce((a, b) => a + Math.pow(b - riskFreeRate, 2), 0) / (downsideReturns.length - 1);
    const downsideStdDev = Math.sqrt(downsideVariance);
    
    if (downsideStdDev === 0) return 0;
    return (meanReturn - riskFreeRate) / downsideStdDev;
}

export function calculateCorrelation(returnsA: number[], returnsB: number[]): number {
    if (returnsA.length !== returnsB.length || returnsA.length === 0) return 0;
    
    const meanA = returnsA.reduce((a, b) => a + b) / returnsA.length;
    const meanB = returnsB.reduce((a, b) => a + b) / returnsB.length;
    
    const num = returnsA.reduce((acc, curr, idx) => {
        return acc + (curr - meanA) * (returnsB[idx] - meanB);
    }, 0);
    
    const denA = Math.sqrt(returnsA.reduce((acc, curr) => acc + Math.pow(curr - meanA, 2), 0));
    const denB = Math.sqrt(returnsB.reduce((acc, curr) => acc + Math.pow(curr - meanB, 2), 0));
    
    if (denA === 0 || denB === 0) return 0;
    return num / (denA * denB);
}
