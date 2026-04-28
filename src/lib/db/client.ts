// src/lib/db/client.ts
import Database from 'better-sqlite3';
import path from 'path';
import { runMigrations } from './migrate';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (_db) return _db;

    const isTest = process.env.NODE_ENV === 'test';
    
    // Use an absolute path anchored to the project root to prevent path resolution issues
    // during Next.js builds or multi-worker dev runs.
    const root = process.env.PROJECT_ROOT || process.cwd();
    const dbPath = isTest
        ? path.join(root, `test_${process.pid}.db`)
        : path.join(root, 'sage.db');

    console.log(`[DB] Initializing at: ${dbPath}`);
    
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    
    // Run migrations on every initialization to ensure schema is always current
    if (!isTest) {
        try {
            runMigrations(_db);
        } catch (e) {
            console.error('[DB] Migration failure:', e);
        }
    }
    
    return _db;
}

const db = getDb();
export default db;
