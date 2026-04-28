#!/usr/bin/env python3
import sys
import json
import numpy as np
import pandas as pd
from pypfopt import EfficientFrontier, risk_models, expected_returns

def optimize():
    try:
        # Read JSON from stdin
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"error": "No input data provided"}), file=sys.stderr)
            return

        data = json.loads(input_data)
        returns_dict = data.get("returns")

        if not returns_dict:
            print(json.dumps({"error": "No returns data found in JSON"}), file=sys.stderr)
            return

        # Convert returns to DataFrame
        returns_df = pd.DataFrame(returns_dict)
        if returns_df.empty:
            print(json.dumps({"error": "Returns data is empty"}), file=sys.stderr)
            return

        n_assets = len(returns_df.columns)
        if n_assets < 2:
            print(json.dumps({"error": "At least two assets are required for optimization"}), file=sys.stderr)
            return

        # Institutional Fix: Our data is ALREADY annualized (Simba).
        # We must set frequency=1 to prevent double-compounding.
        mu = expected_returns.return_model(returns_df, method="mean_historical_return", returns_data=True, frequency=1)
        S = risk_models.risk_matrix(returns_df, method="ledoit_wolf", returns_data=True, frequency=1)

        points = []
        
        # 1. Global Minimum Variance (GMV) Portfolio
        ef_min = EfficientFrontier(mu, S)
        try:
            weights_min = ef_min.min_volatility()
            ret_min, vol_min, _ = ef_min.portfolio_performance()
            points.append({"vol": float(vol_min), "return": float(ret_min), "isCurve": True})
        except Exception:
            pass

        # 2. Efficient Frontier Points
        max_ret = mu.max()
        min_ret = mu.min()
        
        if len(points) > 0:
            start_ret = points[0]["return"]
        else:
            start_ret = min_ret

        if max_ret > start_ret:
            target_returns = np.linspace(start_ret, max_ret, 20)
            for target in target_returns:
                ef = EfficientFrontier(mu, S)
                try:
                    ef.efficient_return(target)
                    ret, vol, _ = ef.portfolio_performance()
                    points.append({"vol": float(vol), "return": float(ret), "isCurve": True})
                except Exception:
                    continue

        # 3. Opportunity Cloud (500 random portfolios)
        cloud = []
        for _ in range(500):
            w = np.random.dirichlet(np.ones(n_assets), size=1)[0]
            portfolio_return = np.dot(w, mu)
            portfolio_vol = np.sqrt(np.dot(w.T, np.dot(S, w)))
            cloud.append({
                "vol": float(portfolio_vol),
                "return": float(portfolio_return),
                "isCurve": False
            })

        print(json.dumps({ "points": points, "cloud": cloud }))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)

if __name__ == "__main__":
    optimize()
