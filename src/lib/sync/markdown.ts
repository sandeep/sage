// src/lib/sync/markdown.ts
import fs from 'fs';
import path from 'path';
import db from '../db/client';

export function syncToMarkdown() {
    const baseDir = path.join(process.cwd(), 'sage');
    const dirs = [path.join(baseDir, 'directives'), path.join(baseDir, 'state')];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // 1. Sync Active Directives
    const activeDirectives = db.prepare("SELECT * FROM directives WHERE status = 'PENDING'").all() as any[];
    let directivesMd = "# Active Directives\n\n";
    if (activeDirectives.length === 0) {
        directivesMd += "No active directives.\n";
    } else {
        activeDirectives.forEach(d => {
            directivesMd += `## [${d.priority}] ${d.type}\n`;
            directivesMd += `- **Description:** ${d.description}\n`;
            directivesMd += `- **Reasoning:** ${d.reasoning || 'N/A'}\n\n`;
        });
    }
    fs.writeFileSync(path.join(baseDir, 'directives', 'active.md'), directivesMd);

    // 2. Sync Portfolio State
    const accounts = db.prepare("SELECT * FROM accounts").all() as any[];
    let stateMd = "# Portfolio State\n\n";
    accounts.forEach(acc => {
        stateMd += `### ${acc.provider} - ${acc.id} (${acc.tax_character})\n`;
        const holdings = db.prepare("SELECT * FROM holdings WHERE account_id = ?").all(acc.id) as any[];
        holdings.forEach(h => {
            stateMd += `- ${h.ticker}: ${h.quantity} units\n`;
        });
        stateMd += "\n";
    });
    fs.writeFileSync(path.join(baseDir, 'state', 'current.md'), stateMd);
}
