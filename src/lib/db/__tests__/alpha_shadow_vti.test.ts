import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import db from '../client';
import { runMigrations } from '../migrate';
import fs from 'fs';
import path from 'path';

describe('Alpha Shadow VTI Table', () => {
    beforeAll(() => {
        runMigrations(db);
    });

    afterAll(() => {
        // Close the DB connection before trying to delete the file
        db.close();
        const dbPath = path.join(process.cwd(), `test_${process.pid}.db`);
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
            // Also cleanup WAL/SHM files if they exist
            if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
            if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
        }
    });

    it('should have the alpha_shadow_vti table with correct schema', () => {
        const tableInfo = db.prepare("PRAGMA table_info(alpha_shadow_vti)").all() as any[];
        
        expect(tableInfo.length).toBe(5);
        
        const dateCol = tableInfo.find(c => c.name === 'date');
        expect(dateCol).toBeDefined();
        expect(dateCol.type).toBe('TEXT');
        expect(dateCol.pk).toBe(1);

        const sharesCol = tableInfo.find(c => c.name === 'shares');
        expect(sharesCol.type).toBe('REAL');
        expect(sharesCol.notnull).toBe(1);

        const priceCol = tableInfo.find(c => c.name === 'price');
        expect(priceCol.type).toBe('REAL');
        expect(priceCol.notnull).toBe(1);

        const valueCol = tableInfo.find(c => c.name === 'value');
        expect(valueCol.type).toBe('REAL');
        expect(valueCol.notnull).toBe(1);

        const depositsCol = tableInfo.find(c => c.name === 'cumulative_deposits');
        expect(depositsCol.type).toBe('REAL');
        expect(depositsCol.notnull).toBe(1);
    });

    it('should support INSERT and SELECT operations', () => {
        const testData = {
            date: '2024-01-01',
            shares: 100.5,
            price: 450.25,
            value: 45247.125,
            cumulative_deposits: 40000.0
        };

        const insert = db.prepare(`
            INSERT INTO alpha_shadow_vti (date, shares, price, value, cumulative_deposits)
            VALUES (?, ?, ?, ?, ?)
        `);
        insert.run(testData.date, testData.shares, testData.price, testData.value, testData.cumulative_deposits);

        const result = db.prepare("SELECT * FROM alpha_shadow_vti WHERE date = ?").get(testData.date) as any;
        expect(result).toEqual(testData);
    });
});
