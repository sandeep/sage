// src/app/api/admin/allocation/history/route.ts
import db from '../../../../../lib/db/client';

function computeExpectedCagr(tree: Record<string, any>): number {
    let sum = 0;
    function walk(node: any) {
        if (node.expected_return != null) sum += node.weight * node.expected_return;
        Object.values(node.categories ?? {}).forEach(walk);
        Object.values(node.subcategories ?? {}).forEach(walk);
    }
    Object.values(tree).forEach(walk);
    return sum;
}

function computeStockWeight(tree: Record<string, any>): number {
    return (tree['Stock']?.weight as number) ?? 0;
}

export async function GET() {
    const rows = db.prepare(
        `SELECT id, created_at, label, snapshot FROM allocation_versions ORDER BY id ASC`
    ).all() as { id: number; created_at: string; label: string; snapshot: string }[];

    const history = rows.map(row => {
        try {
            const tree = JSON.parse(row.snapshot);
            return {
                id: row.id,
                date: row.created_at.slice(0, 10),
                label: row.label,
                expectedCagr: computeExpectedCagr(tree),
                stockWeight: computeStockWeight(tree),
            };
        } catch {
            return null;
        }
    }).filter(Boolean);

    return Response.json(history);
}
