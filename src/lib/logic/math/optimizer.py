#!/usr/bin/env python3
import sys
import json
import numpy as np
import pandas as pd
from pypfopt import EfficientFrontier, risk_models, expected_returns, objective_functions

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
        
        # ACADEMIC FIX: Drop assets with less than 10 years of data, then drop rows with any NaNs
        # MVO requires a dense matrix.
        returns_df = returns_df.dropna(thresh=10, axis=1)
        returns_df = returns_df.dropna(axis=0)

        if returns_df.empty or len(returns_df) < 5:
            print(json.dumps({"error": "Insufficient overlapping historical data to compute covariance matrix."}), file=sys.stderr)
            sys.exit(1)

        n_assets = len(returns_df.columns)
        if n_assets < 2:
            print(json.dumps({"error": "At least two assets with overlapping data are required."}), file=sys.stderr)
            sys.exit(1)

        # Institutional Fix: Our data is ALREADY annualized (Simba).
        # We must set frequency=1 to prevent double-compounding.
        mu = expected_returns.return_model(returns_df, method="mean_historical_return", returns_data=True, frequency=1)
        S = risk_models.risk_matrix(returns_df, method="ledoit_wolf", returns_data=True, frequency=1)

        points = []
        
        # 1. Global Minimum Variance (GMV) Portfolio
        ef_min = EfficientFrontier(mu, S)
        ef_min.add_objective(objective_functions.L2_reg, gamma=0.1) # Penalize concentration
        try:
            weights_min = ef_min.min_volatility()
            ret_min, vol_min, _ = ef_min.portfolio_performance()
            points.append({"vol": float(vol_min), "return": float(ret_min), "isCurve": True})
        except Exception:
            pass

        # 2. Efficient Frontier Points
        max_ret = mu.max()
        min_ret = ret_min if len(points) > 0 else mu.min()
        
        if max_ret > min_ret:
            target_returns = np.linspace(min_ret, max_ret, 30)
            for target in target_returns:
                ef = EfficientFrontier(mu, S)
                ef.add_objective(objective_functions.L2_reg, gamma=0.1) # Penalize concentration
                try:
                    ef.efficient_return(target)
                    ret, vol, _ = ef.portfolio_performance()
                    points.append({"vol": float(vol), "return": float(ret), "isCurve": True})
                except Exception:
                    continue

        # 3. Opportunity Cloud (2000 random portfolios for better density)
        cloud = []
        for i in range(2000):
            # Mix standard Dirichlet (center-heavy) with exponential (boundary-heavy)
            if i % 2 == 0:
                w = np.random.dirichlet(np.ones(n_assets), size=1)[0]
            else:
                # Boundary sampling: force some assets to near-zero
                raw_w = np.random.exponential(scale=1.0, size=n_assets)
                mask = np.random.binomial(1, 0.5, size=n_assets)
                w = raw_w * mask
                if w.sum() == 0: w = np.ones(n_assets) # fallback
                w = w / w.sum()
                
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
