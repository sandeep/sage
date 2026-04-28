// src/lib/db/purge_dummies.ts
import db from './client';

export function purge() {
    console.log("🧹 Purging dummy data...");
    
    // 1. Remove accounts that were placeholder examples
    const dummyIds = ['REPLACE_ME_ROTH', 'REPLACE_ME_TAXABLE', 'Fidelity-Roth', 'Fidelity-401k', 'Fidelity-Taxable', 'acc1', 'acc-shield', 'acc-deferred'];
    
    db.transaction(() => {
        dummyIds.forEach(id => {
            db.prepare("DELETE FROM holdings WHERE account_id = ?").run(id);
            db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
        });
    })();

    console.log("✅ Dummies purged. Your database is now clean.");
}

if (require.main === module) {
    purge();
}
