
import { calculateHierarchicalMetrics } from '@/lib/logic/xray';

export async function GET() {
    const metrics = calculateHierarchicalMetrics();
    const actualWeights: Record<string, number> = {};
    
    // Level 2 are the leaf categories we edit in the sliders
    metrics.filter(m => m.level === 2).forEach(m => {
        actualWeights[m.label] = m.actualPortfolio;
    });

    // Also include top-level Asset Classes
    metrics.filter(m => m.level === 0).forEach(m => {
        actualWeights[m.label] = m.actualPortfolio;
    });

    return Response.json(actualWeights);
}
