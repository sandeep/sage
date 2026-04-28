// src/lib/db/bootstrap.ts
import db from './client';
import fs from 'fs';
import path from 'path';
import { seedAllocation } from './seed_allocation';

export function bootstrap() {
    seedAllocation();

    const bootstrapPath = path.join(process.cwd(), 'src/lib/data/bootstrap_accounts.json');
    
    if (!fs.existsSync(bootstrapPath)) {
        console.log("ℹ️ No 'bootstrap_accounts.json' found. Skipping account mapping bootstrap.");
        return;
    }

    console.log("🚀 Bootstrapping Account Mappings from local JSON...");

    try {
        const accounts = JSON.parse(fs.readFileSync(bootstrapPath, 'utf8'));
        
        const insertAccount = db.prepare(`
            INSERT OR REPLACE INTO accounts (id, provider, tax_character, account_type, nickname)
            VALUES (?, ?, ?, ?, ?)
        `);

        db.transaction(() => {
            accounts.forEach((acc: any) => {
                insertAccount.run(acc.id, acc.provider, acc.tax_character, acc.account_type || null, acc.nickname);
            });
        })();

        console.log(`✅ ${accounts.length} accounts bootstrapped.`);
    } catch (e: any) {
        console.error(`❌ Failed to bootstrap accounts: ${e.message}`);
    }
}

if (require.main === module) {
    bootstrap();
}
