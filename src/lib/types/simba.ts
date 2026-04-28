export interface SimbaAsset {
    label: string;
    returns: Record<string, number>;
    volatility: number;
    metrics: {
        sharpe: number;
        sortino: number;
        max_drawdown: number;
    };
}

export interface SimbaData {
    asset_classes: Record<string, SimbaAsset>;
    market_correlation: Record<string, Record<string, number>>;
    meta: {
        years: number[];
        risk_free_rate: number;
    };
}
