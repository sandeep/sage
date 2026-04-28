
import { NextRequest, NextResponse } from 'next/server';
import { runMonteCarlo, SimulationConfig } from '@/lib/logic/montecarlo/simulator';
import { evaluateSuccessProbability, GoalConfig } from '@/lib/logic/montecarlo/evaluator';
import { calculateHierarchicalMetrics } from '@/lib/logic/xray';
import { flattenLeafWeights } from '@/lib/logic/allocationSimulator';
import { generateSimulationHash, getCachedSimulation, saveCachedSimulation } from '@/lib/logic/simulationCache';
import { TODAY_ANCHOR } from '@/lib/logic/referenceDates';
import targetTree from '@/lib/data/target_allocation.json';

/**
 * API: Run Bootstrap Monte Carlo Simulation
 * POST /api/performance/montecarlo
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const goalConfig: GoalConfig = body.goal || { type: 'PRESERVATION' };
        const portfolioType = body.portfolioType || 'TARGET'; // 'ACTUAL' | 'TARGET'
        const withdrawalRate = body.withdrawalRate || 0;
        
        // 1. Resolve Weights
        let weights: Record<string, number> = {};
        const metrics = calculateHierarchicalMetrics();

        if (portfolioType === 'ACTUAL') {
            // Level 2 metrics are the leaf categories
            metrics.filter(m => m.level === 2 && m.actualPortfolio > 0).forEach(m => {
                weights[m.label] = m.actualPortfolio;
            });
            // Handle redistributed weights if not 100% (e.g. unmapped assets)
            const sum = Object.values(weights).reduce((a, b) => a + b, 0);
            if (sum > 0 && sum < 0.99) {
                for (const k in weights) weights[k] /= sum;
            }
        } else {
            weights = flattenLeafWeights(targetTree as Record<string, any>);
        }
        
        // 2. Resolve Current Portfolio Total Value
        const initialValue = metrics.find(m => m.label === 'Total Portfolio')?.actualValue || 1000000;

        // 2b. Cache check — skip expensive simulation if inputs unchanged today
        const horizonKey = `30Y-wr${withdrawalRate}-${goalConfig.type}`;
        const simHash = generateSimulationHash(weights, horizonKey, TODAY_ANCHOR);
        const cached = getCachedSimulation(simHash, horizonKey);
        if (cached) {
            return Response.json(cached.results);
        }

        // 3. Configure Simulation
        const simConfig: SimulationConfig = {
            iterations: 5000, 
            durationYears: 30,
            initialValue,
            targetWeights: weights,
            blockSize: 1,
            rebalanceAnnually: true,
            withdrawalRate
        };

        // 4. Run Core Simulation
        const result = runMonteCarlo(simConfig);

        // 5. Evaluate Success
        const successProbability = evaluateSuccessProbability(result.finalValues, initialValue, goalConfig);

        const responsePayload = {
            percentiles: result.percentiles,
            successProbability,
            initialValue,
            goalType: goalConfig.type,
            portfolioType,
            withdrawalRate
        };
        saveCachedSimulation(simHash, horizonKey, responsePayload as any, []);
        return Response.json(responsePayload);

    } catch (e: any) {
        console.error('Monte Carlo API Error:', e.message);
        return NextResponse.json({ error: 'Failed to run simulation' }, { status: 500 });
    }
}
