import { describe, it, expect } from 'vitest';

// Copy of the function under test — paste the FIXED version
function updateLeafWeight(
    tree: Record<string, any>,
    targetLabel: string,
    newWeight: number
): Record<string, any> {
    function walkUpdate(node: any): any {
        const updatedCats = node.categories
            ? Object.fromEntries(
                Object.entries(node.categories).map(([l, d]) => [
                    l,
                    l === targetLabel ? { ...(d as any), weight: newWeight } : walkUpdate(d),
                ])
              )
            : undefined;
        const updatedSubs = node.subcategories
            ? Object.fromEntries(
                Object.entries(node.subcategories).map(([l, d]) => [
                    l,
                    l === targetLabel ? { ...(d as any), weight: newWeight } : walkUpdate(d),
                ])
              )
            : undefined;
        return {
            ...node,
            ...(updatedCats ? { categories: updatedCats } : {}),
            ...(updatedSubs ? { subcategories: updatedSubs } : {}),
        };
    }
    return Object.fromEntries(
        Object.entries(tree).map(([l, d]) => [
            l,
            l === targetLabel ? { ...(d as any), weight: newWeight } : walkUpdate(d),
        ])
    );
}

function computeTopLevelSum(tree: Record<string, any>): number {
    return Object.values(tree).reduce((sum: number, node: any) => sum + (node.weight ?? 0), 0);
}

const MINI_TREE = {
    Stock: {
        weight: 0.98,
        categories: {
            'US Stock': {
                weight: 0.68,
                subcategories: {
                    'US Large Cap': { weight: 0.20 },
                    'Small Cap Value': { weight: 0.10 },
                },
            },
        },
    },
    Bond: {
        weight: 0.02,
        categories: {
            'US Aggregate Bond': { weight: 0.02 }, // level-1 leaf — no subcategories
        },
    },
    Cash: { weight: 0.00 },
};

describe('updateLeafWeight', () => {
    it('updates a level-2 subcategory weight', () => {
        const result = updateLeafWeight(MINI_TREE, 'US Large Cap', 0.25);
        expect(result.Stock.categories['US Stock'].subcategories['US Large Cap'].weight).toBe(0.25);
        expect(result.Stock.categories['US Stock'].subcategories['Small Cap Value'].weight).toBe(0.10);
    });

    it('updates a level-1 leaf category weight (Bond special case)', () => {
        const result = updateLeafWeight(MINI_TREE, 'US Aggregate Bond', 0.05);
        expect(result.Bond.categories['US Aggregate Bond'].weight).toBe(0.05);
        expect(result.Stock.weight).toBe(0.98);
    });

    it('does not mutate the original tree', () => {
        const original = MINI_TREE.Bond.categories['US Aggregate Bond'].weight;
        updateLeafWeight(MINI_TREE, 'US Aggregate Bond', 0.10);
        expect(MINI_TREE.Bond.categories['US Aggregate Bond'].weight).toBe(original);
    });
});

describe('computeTopLevelSum', () => {
    it('sums top-level weights correctly', () => {
        expect(computeTopLevelSum(MINI_TREE)).toBeCloseTo(1.00);
    });

    it('detects invalid sum', () => {
        const bad = { ...MINI_TREE, Bond: { ...MINI_TREE.Bond, weight: 0.10 } };
        expect(computeTopLevelSum(bad)).toBeGreaterThan(1.0);
    });
});
