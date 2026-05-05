
export interface Coordinates {
    label: string;
    return: number;
    vol: number;
    isCurve?: boolean;
}

export interface LeakageRow {
    label: string;
    weight: number;
    marketReturn: number;
    dollarImpact: number;
}

export type AccountType = 'TAXABLE' | 'DEFERRED' | 'ROTH';

export interface TaxEfficiencyTier {
    tier: 'very_inefficient' | 'inefficient' | 'moderate' | 'efficient';
    bps: number;
}

export interface RegimeEvolution {
    label: string;
    startDate: string;
    endDate: string | null;
    nominalReturn: number;
    sharpeRatio: number;
    m2Delta: number;
    improvementReturn: number;
    improvementSharpe: number;
}

export interface AuditReport {
    tv: number;
    accountCount: number;
    latestPriceDate: string;
    efficiency: any;
    horizons: any[];
    leakageLedger: LeakageRow[];
    coordinates: {
        vti: Coordinates;
        target: Coordinates;
        actual: Coordinates;
    };
    frontierPoints: {
        points: Array<{ vol: number; return: number; isCurve: boolean }>;
        cloud: Array<{ vol: number; return: number; isCurve: boolean }>;
    };
    globalFrontierPoints: {
        points: Array<{ vol: number; return: number; isCurve: boolean }>;
    };
    taxIssues: any[];
    feeRisks: any[];
    concentrationRisks: any[];
    currentCagr: number;
    targetCagr: number;
    strategyHistory?: RegimeEvolution[];
}
