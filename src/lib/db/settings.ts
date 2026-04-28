
import db from './client';

export interface StrategicSettings {
    ordinary_tax_rate: number;
    dividend_tax_rate: number;
    risk_free_rate: number;
    max_tranche_size: number;
}

const DEFAULT_SETTINGS: StrategicSettings = {
    ordinary_tax_rate: 0.35,
    dividend_tax_rate: 0.15,
    risk_free_rate: 0.05,
    max_tranche_size: 20000
};

export function getStrategicSettings(): StrategicSettings {
    try {
        const rows = db.prepare('SELECT key, value FROM user_settings').all() as { key: string; value: number }[];
        const settings = { ...DEFAULT_SETTINGS };
        
        rows.forEach(row => {
            if (row.key in settings) {
                (settings as any)[row.key] = row.value;
            }
        });
        
        return settings;
    } catch (e) {
        console.error('Failed to fetch settings from DB, using defaults', e);
        return DEFAULT_SETTINGS;
    }
}

export function updateStrategicSetting(key: keyof StrategicSettings, value: number) {
    db.prepare(`
        INSERT OR REPLACE INTO user_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(key, value);
}
