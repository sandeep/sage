
-- Migration: Strategic Assumptions Persistence
-- Creates a table for user-editable tax and risk rates

CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed with current 'Elite Tier' Baselines
INSERT OR IGNORE INTO user_settings (key, value) VALUES ('ordinary_tax_rate', 0.35);
INSERT OR IGNORE INTO user_settings (key, value) VALUES ('dividend_tax_rate', 0.15);
INSERT OR IGNORE INTO user_settings (key, value) VALUES ('risk_free_rate', 0.05);
