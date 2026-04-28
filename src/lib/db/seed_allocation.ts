// src/lib/db/seed_allocation.ts
import db from './client';
import targetAllocation from '../data/target_allocation.json';

interface AllocNode {
    weight: number;
    expected_return?: number;
    categories?: Record<string, AllocNode>;
    subcategories?: Record<string, AllocNode>;
}

function walk(label: string, node: AllocNode, parentLabel: string | null, level: number): void {
    db.prepare(`
        INSERT OR IGNORE INTO allocation_nodes (label, parent_label, weight, expected_return, level)
        VALUES (?, ?, ?, ?, ?)
    `).run(label, parentLabel, node.weight, node.expected_return ?? null, level);

    for (const [cat, data] of Object.entries(node.categories ?? {})) {
        walk(cat, data, label, level + 1);
    }
    for (const [sub, data] of Object.entries(node.subcategories ?? {})) {
        walk(sub, data, label, level + 1);
    }
}

export function seedAllocation(): void {
    const existing = db.prepare('SELECT COUNT(*) as n FROM allocation_nodes').get() as { n: number };
    if (existing.n > 0) return; // already seeded — idempotent

    const tx = db.transaction(() => {
        for (const [label, data] of Object.entries(targetAllocation)) {
            walk(label, data as AllocNode, null, 0);
        }

        // Record the initial version snapshot
        db.prepare(`
            INSERT INTO allocation_versions (label, snapshot)
            VALUES ('Initial seed', ?)
        `).run(JSON.stringify(targetAllocation));
    });
    tx();

    console.log('seedAllocation: seeded', db.prepare('SELECT COUNT(*) as n FROM allocation_nodes').get());
}
