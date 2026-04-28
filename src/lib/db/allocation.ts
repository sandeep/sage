// src/lib/db/allocation.ts
import db from './client';

export interface AllocationNode {
    label: string;
    parent_label: string | null;
    weight: number;
    expected_return: number | null;
    level: number;
}

export function getAllocationNodes(): AllocationNode[] {
    return db.prepare('SELECT * FROM allocation_nodes ORDER BY level, parent_label, weight DESC, label').all() as AllocationNode[];
}

/**
 * Reconstructs the allocation tree in the same shape as target_allocation.json.
 * Level-0 children are top-level keys.
 * Level-1 children go under "categories".
 * Level-2 children go under "subcategories".
 */
export function getAllocationTree(): Record<string, any> {
    const nodes = getAllocationNodes();
    if (nodes.length === 0) return {};

    function buildNode(node: AllocationNode): any {
        const result: any = { weight: node.weight };
        if (node.expected_return !== null) result.expected_return = node.expected_return;

        const children = nodes.filter(n => n.parent_label === node.label);
        const level1 = children.filter(c => c.level === 1);
        const level2 = children.filter(c => c.level === 2);

        if (level1.length > 0) {
            result.categories = Object.fromEntries(level1.map(c => [c.label, buildNode(c)]));
        }
        if (level2.length > 0) {
            result.subcategories = Object.fromEntries(level2.map(c => [c.label, buildNode(c)]));
        }
        return result;
    }

    const roots = nodes.filter(n => n.parent_label === null);
    return Object.fromEntries(roots.map(r => [r.label, buildNode(r)]));
}
