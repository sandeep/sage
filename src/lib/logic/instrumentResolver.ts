import db from '../db/client';

export type ResolutionTier = 'D' | 'C' | 'B' | 'DEFAULT';

export interface InstrumentResolution {
    ticker: string;
    tier: ResolutionTier;
    subtitle: string;
}

// Tier B: provider-native funds. Lowest ER available at each platform.
const PROVIDER_MAP: Record<string, Record<string, string>> = {
    VANGUARD: {
        'Total Stock Market': 'VIIIX',
        'Small Cap Value': 'VSIAX',
        'US Aggregate Bond': 'VBTLX',
        'Developed Market': 'VTMGX',
        'Emerging Market': 'VEMAX',
        'REIT': 'VGSLX',
        'US Large Cap/SP500/DJIX': 'VIIIX',
    },
    FIDELITY: {
        'Total Stock Market': 'FZROX',
        'US Aggregate Bond': 'FXNAX',
        'Small Cap Value': 'FISVX',
        'Developed Market': 'FSPSX',
        'Emerging Market': 'FPADX',
        'US Large Cap/SP500/DJIX': 'FXAIX',
    },
    SCHWAB: {
        'Total Stock Market': 'SCHB',
        'US Aggregate Bond': 'SCHZ',
        'Small Cap Value': 'DFSVX',
        'Developed Market': 'SCHF',
        'Emerging Market': 'SCHE',
        'US Large Cap/SP500/DJIX': 'SCHX',
    },
};

// Tier DEFAULT: best generic ETF per class
const DEFAULT_MAP: Record<string, string> = {
    'Total Stock Market': 'VTI',
    'Small Cap Value': 'AVUV',
    'US Aggregate Bond': 'BND',
    'Developed Market': 'VEA',
    'Emerging Market': 'VWO',
    'REIT': 'VNQ',
    'US Large Cap/SP500/DJIX': 'VOO',
    'Cash': 'SGOV',
};

export function resolveInstrument(accountId: string, assetClass: string): InstrumentResolution {
    const account = db.prepare("SELECT provider FROM accounts WHERE id = ?").get(accountId) as { provider: string } | undefined;
    const provider = account?.provider ?? 'UNKNOWN';

    // Tier D: already held in this account, maps to this asset class
    const held = db.prepare(`
        SELECT hl.ticker FROM holdings_ledger hl
        JOIN asset_registry ar ON ar.ticker = hl.ticker
        WHERE hl.account_id = ?
          AND hl.snapshot_date = (SELECT MAX(snapshot_date) FROM holdings_ledger WHERE account_id = ?)
          AND ar.weights LIKE ? ESCAPE '\\'
        LIMIT 1
    `).get(accountId, accountId, `%"${assetClass.replace(/[%_\\]/g, '\\$&')}":%`) as { ticker: string } | undefined;

    if (held) {
        return {
            ticker: held.ticker,
            tier: 'D',
            subtitle: `${assetClass} · already in this account`,
        };
    }

    // Tier C: per-account allowlist
    const allowlisted = db.prepare(`
        SELECT ticker FROM account_instrument_allowlist
        WHERE account_id = ? AND asset_class = ?
        LIMIT 1
    `).get(accountId, assetClass) as { ticker: string } | undefined;

    if (allowlisted) {
        return {
            ticker: allowlisted.ticker,
            tier: 'C',
            subtitle: `${assetClass} · on your list for this account`,
        };
    }

    // Tier B: provider match
    const providerTicker = PROVIDER_MAP[provider]?.[assetClass];
    if (providerTicker) {
        const providerLabel = provider.charAt(0) + provider.slice(1).toLowerCase();
        return {
            ticker: providerTicker,
            tier: 'B',
            subtitle: `${assetClass} · ${providerLabel} fund — not yet held`,
        };
    }

    // Tier DEFAULT
    const defaultTicker = DEFAULT_MAP[assetClass] ?? assetClass;
    return {
        ticker: defaultTicker,
        tier: 'DEFAULT',
        subtitle: `${assetClass} · best available ETF — not yet held`,
    };
}
