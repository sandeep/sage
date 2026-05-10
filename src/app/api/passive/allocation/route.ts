// src/app/api/admin/allocation/route.ts
import db from '../../../../lib/db/client';
import { getAllocationTree } from '../../../../lib/db/allocation';

export async function GET() {
    const tree = getAllocationTree();
    return Response.json(tree);
}

export async function PUT(req: Request) {
    const newTree = await req.json();

    function walk(label: string, node: any, parentLabel: string | null, level: number): void {
        db.prepare(`
            INSERT OR REPLACE INTO allocation_nodes (label, parent_label, weight, expected_return, level)
            VALUES (?, ?, ?, ?, ?)
        `).run(label, parentLabel, node.weight, node.expected_return ?? null, level);
        for (const [cat, data] of Object.entries(node.categories ?? {})) walk(cat, data as any, label, level + 1);
        for (const [sub, data] of Object.entries(node.subcategories ?? {})) walk(sub, data as any, label, level + 1);
    }

    const tx = db.transaction(() => {
        // 1. Close current regime
        db.prepare(`UPDATE allocation_versions SET end_date = CURRENT_TIMESTAMP WHERE end_date IS NULL`).run();

        // 2. Save new regime as current
        db.prepare(`INSERT INTO allocation_versions (label, snapshot, start_date) VALUES (?, ?, CURRENT_TIMESTAMP)`)
          .run(`Saved ${new Date().toISOString().split('T')[0]}`, JSON.stringify(newTree));

        // 3. Update active nodes
        db.prepare('DELETE FROM allocation_nodes').run();
        for (const [label, data] of Object.entries(newTree)) walk(label, data as any, null, 0);
    });
    tx();

    return Response.json({ ok: true });
}
