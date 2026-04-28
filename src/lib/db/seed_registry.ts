// src/lib/db/seed_registry.ts
import type Database from 'better-sqlite3';

const REGISTRY = [
    // CASH
    { ticker: '**',       canonical: 'Cash Sweep',  description: 'Cash',                                        asset_type: 'Cash',      weights: { Cash: 1.0 }, is_core: true,  index_tracked: '' },
    { ticker: 'CORE**',   canonical: 'Cash Sweep',  description: 'Fidelity FDIC-Insured Deposit Sweep',         asset_type: 'Cash',      weights: { Cash: 1.0 }, is_core: true,  index_tracked: '' },
    { ticker: 'SPAXX**',  canonical: 'Cash Sweep',  description: 'Fidelity Government Money Market',            asset_type: 'Cash',      weights: { Cash: 1.0 }, is_core: true,  index_tracked: '' },
    { ticker: 'FDRXX**',  canonical: 'Cash Sweep',  description: 'Fidelity Government Cash Reserves',           asset_type: 'Cash',      weights: { Cash: 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VMFXX',    canonical: 'Cash Sweep',  description: 'Vanguard Federal Money Market Fund',          asset_type: 'Cash',      weights: { Cash: 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VMMXX',    canonical: 'Cash Sweep',  description: 'Vanguard Cash Reserves Federal Money Market', asset_type: 'Cash',      weights: { Cash: 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VMRXX',    canonical: 'Cash Sweep',  description: 'Vanguard Cash Reserves',                      asset_type: 'Cash',      weights: { Cash: 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'CASH',     canonical: 'Cash',        description: 'Cash',                                        asset_type: 'Cash',      weights: { Cash: 1.0 }, is_core: false, index_tracked: '' },
    // TOTAL US STOCK MARKET
    { ticker: 'FZROX', canonical: 'Total US Stock Market', description: 'Fidelity ZERO Total Market Index Fund',             asset_type: 'FUND', weights: { 'Total Stock Market': 1.0 }, is_core: true,  index_tracked: 'Fidelity U.S. Total Investable Market Index' },
    { ticker: 'FSKAX', canonical: 'Total US Stock Market', description: 'Fidelity Total Market Index Fund',                  asset_type: 'FUND', weights: { 'Total Stock Market': 1.0 }, is_core: true,  index_tracked: 'Dow Jones US Total Stock Market Index' },
    { ticker: 'VTSAX', canonical: 'Total US Stock Market', description: 'Vanguard Total Stock Market Index Fund Admiral',    asset_type: 'FUND', weights: { 'Total Stock Market': 1.0 }, is_core: true,  index_tracked: 'CRSP Total Market Index' },
    { ticker: 'ITOT',  canonical: 'Total US Stock Market', description: 'iShares Core S&P Total US Stock Market ETF',        asset_type: 'ETF',  weights: { 'Total Stock Market': 1.0 }, is_core: true,  index_tracked: 'S&P Total Market Index' },
    { ticker: 'VTI',   canonical: 'Total US Stock Market', description: 'Vanguard Total Stock Market Index Fund ETF',        asset_type: 'ETF',  weights: { 'Total Stock Market': 1.0 }, is_core: false, index_tracked: '' },
    // US LARGE CAP
    { ticker: 'FXAIX', canonical: 'US Large Cap (S&P 500)', description: 'Fidelity 500 Index Fund',                              asset_type: 'FUND', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: true,  index_tracked: 'S&P 500' },
    { ticker: 'VFIAX', canonical: 'US Large Cap (S&P 500)', description: 'Vanguard 500 Index Fund Admiral Shares',               asset_type: 'FUND', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: true,  index_tracked: 'S&P 500' },
    { ticker: 'IVV',   canonical: 'US Large Cap (S&P 500)', description: 'iShares Core S&P 500 ETF',                             asset_type: 'ETF',  weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: true,  index_tracked: 'S&P 500' },
    { ticker: 'VOO',   canonical: 'US Large Cap (S&P 500)', description: 'Vanguard S&P 500 ETF',                                 asset_type: 'ETF',  weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VINIX', canonical: 'US Large Cap (S&P 500)', description: 'Vanguard Institutional Index Fund Institutional',      asset_type: 'FUND', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VIIIX', canonical: 'US Large Cap (S&P 500)', description: 'Vanguard Institutional Index Fund Institutional Plus', asset_type: 'FUND', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VFFSX', canonical: 'US Large Cap (S&P 500)', description: 'Vanguard 500 Index Institutional Select Shares',       asset_type: 'FUND', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VFINX', canonical: 'US Large Cap (S&P 500)', description: 'Vanguard 500 Index Fund Investor Shares',              asset_type: 'FUND', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'PREIX', canonical: 'US Large Cap (S&P 500)', description: 'T. Rowe Price Equity Index 500 Fund',                  asset_type: 'FUND', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'QQQ',   canonical: 'US Large Cap (NASDAQ)',  description: 'Invesco QQQ Trust, Series 1',                          asset_type: 'ETF',  weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'FCNTX', canonical: 'Fidelity Contrafund',    description: 'Fidelity Contrafund',                                  asset_type: 'FUND', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'FOCPX', canonical: 'Fidelity OTC Portfolio', description: 'Fidelity OTC Portfolio',                               asset_type: 'FUND', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    // VTIVX is a fund-of-funds: ~47.7% Total US, ~34.5% Intl Developed, ~12.5% US Bond, ~5.3% Intl Bond
    { ticker: 'VTIVX', canonical: 'Vanguard Target 2045',   description: 'Vanguard Target Retirement 2045 Fund',                 asset_type: 'FUND', weights: { 'Total Stock Market': 0.477, 'Developed Market': 0.345, 'US Aggregate Bond': 0.125, 'ex-US Aggregate Bond': 0.053 }, is_core: false, index_tracked: '' },
    { ticker: 'FSTVX', canonical: 'US Large Cap (S&P 500)', description: 'Fidelity Total Market Index (legacy)',                  asset_type: 'FUND', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    // Individual stocks
    { ticker: 'AAPL',  canonical: 'Apple Inc',           description: 'Apple Inc',              asset_type: 'EQUITY', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'MSFT',  canonical: 'Microsoft Corp',      description: 'Microsoft Corp',         asset_type: 'EQUITY', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'AMZN',  canonical: 'Amazon.com Inc',      description: 'Amazon.com Inc',         asset_type: 'EQUITY', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'GOOGL', canonical: 'Alphabet Inc',        description: 'Alphabet Inc Class A',   asset_type: 'EQUITY', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'GOOG',  canonical: 'Alphabet Inc',        description: 'Alphabet Inc Class C',   asset_type: 'EQUITY', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'META',  canonical: 'Meta Platforms Inc',  description: 'Meta Platforms Inc',     asset_type: 'EQUITY', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'NVDA',  canonical: 'NVIDIA Corp',         description: 'NVIDIA Corp',            asset_type: 'EQUITY', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'INTC',  canonical: 'Intel Corp',          description: 'Intel Corp',             asset_type: 'EQUITY', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'SNOW',  canonical: 'Snowflake Inc',       description: 'Snowflake Inc',          asset_type: 'EQUITY', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'LYV',   canonical: 'Live Nation',         description: 'Live Nation Entertainment Inc', asset_type: 'EQUITY', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'SOXL',  canonical: 'Semiconductor 3x',   description: 'Direxion Daily Semiconductor Bull 3X ETF', asset_type: 'ETF', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'FRC',   canonical: 'First Republic Bank', description: 'First Republic Bank (delisted)', asset_type: 'EQUITY', weights: { 'US Large Cap/SP500/DJIX': 1.0 }, is_core: false, index_tracked: '' },
    // MID CAP
    { ticker: 'FSMDX', canonical: 'US Mid Cap', description: 'Fidelity Mid Cap Index Fund',         asset_type: 'FUND', weights: { 'Mid-Cap': 1.0 }, is_core: true,  index_tracked: 'Russell Mid Cap Index' },
    { ticker: 'IJH',   canonical: 'US Mid Cap', description: 'iShares Core S&P Mid-Cap ETF',        asset_type: 'ETF',  weights: { 'Mid-Cap': 1.0 }, is_core: true,  index_tracked: 'S&P MidCap 400 Index' },
    { ticker: 'VIMAX', canonical: 'US Mid Cap', description: 'Vanguard Mid-Cap Index Fund Admiral',  asset_type: 'FUND', weights: { 'Mid-Cap': 1.0 }, is_core: true,  index_tracked: 'CRSP US Mid Cap Index' },
    { ticker: 'SHOP',  canonical: 'Shopify Inc', description: 'Shopify Inc',                         asset_type: 'EQUITY', weights: { 'Mid-Cap': 1.0 }, is_core: false, index_tracked: '' },
    // SMALL CAP
    { ticker: 'FSSNX', canonical: 'US Small Cap', description: 'Fidelity Small Cap Index Fund',         asset_type: 'FUND', weights: { 'Small-Cap': 1.0 }, is_core: true,  index_tracked: 'Russell 2000 Index' },
    { ticker: 'IJR',   canonical: 'US Small Cap', description: 'iShares Core S&P Small-Cap ETF',        asset_type: 'ETF',  weights: { 'Small-Cap': 1.0 }, is_core: true,  index_tracked: 'S&P SmallCap 600 Index' },
    { ticker: 'VSMAX', canonical: 'US Small Cap', description: 'Vanguard Small Cap Index Fund Admiral',  asset_type: 'FUND', weights: { 'Small-Cap': 1.0 }, is_core: true,  index_tracked: 'CRSP US Small Cap Index' },
    { ticker: 'NSIDX', canonical: 'US Small Cap', description: 'Northern Small Cap Index Fund',           asset_type: 'FUND', weights: { 'Small-Cap': 1.0 }, is_core: false, index_tracked: '' },
    // SMALL CAP VALUE
    { ticker: 'AVUV',  canonical: 'Small Cap Value', description: 'Avantis U.S. Small Cap Value ETF',          asset_type: 'ETF',  weights: { 'Small Cap Value': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VBR',   canonical: 'Small Cap Value', description: 'Vanguard Small-Cap Value Index Fund ETF',    asset_type: 'ETF',  weights: { 'Small Cap Value': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'IJS',   canonical: 'Small Cap Value', description: 'iShares S&P Small-Cap 600 Value ETF',        asset_type: 'ETF',  weights: { 'Small Cap Value': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VSIAX', canonical: 'Small Cap Value', description: 'Vanguard Small Cap Value Index Fund Admiral', asset_type: 'FUND', weights: { 'Small Cap Value': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'FCPVX', canonical: 'Small Cap Value', description: 'Fidelity Small Cap Value Fund',               asset_type: 'FUND', weights: { 'Small Cap Value': 1.0 }, is_core: false, index_tracked: '' },
    // EXTENDED MARKET
    { ticker: 'FZIPX', canonical: 'Extended Market', description: 'Fidelity ZERO Extended Market Index Fund',  asset_type: 'FUND', weights: { 'Non Big (Ext Market/Small Blend)': 1.0 }, is_core: true,  index_tracked: 'Fidelity U.S. Extended Investable Market Index' },
    { ticker: 'FSMAX', canonical: 'Extended Market', description: 'Fidelity Extended Market Index Fund',        asset_type: 'FUND', weights: { 'Non Big (Ext Market/Small Blend)': 1.0 }, is_core: true,  index_tracked: 'Dow Jones U.S. Completion Total Stock Market Index' },
    { ticker: 'VEXAX', canonical: 'Extended Market', description: 'Vanguard Extended Market Index Fund Admiral', asset_type: 'FUND', weights: { 'Non Big (Ext Market/Small Blend)': 1.0 }, is_core: true,  index_tracked: 'S&P Completion Index' },
    { ticker: 'VIEIX', canonical: 'Extended Market', description: 'Vanguard Extended Market Index Fund Institutional', asset_type: 'FUND', weights: { 'Non Big (Ext Market/Small Blend)': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'FSEVX', canonical: 'Extended Market', description: 'Fidelity Extended Market (legacy)',           asset_type: 'FUND', weights: { 'Non Big (Ext Market/Small Blend)': 1.0 }, is_core: false, index_tracked: '' },
    // TOTAL INTERNATIONAL (blended weights)
    { ticker: 'FZILX', canonical: 'Total Intl Stock Market', description: 'Fidelity ZERO International Index Fund',               asset_type: 'FUND', weights: { 'Developed Market': 0.75, 'Emerging Market': 0.25 }, is_core: true,  index_tracked: 'Fidelity Global ex US Index' },
    { ticker: 'FTIHX', canonical: 'Total Intl Stock Market', description: 'Fidelity Total International Index Fund',               asset_type: 'FUND', weights: { 'Developed Market': 0.75, 'Emerging Market': 0.25 }, is_core: true,  index_tracked: 'MSCI ACWI ex USA IMI Index' },
    { ticker: 'VTIAX', canonical: 'Total Intl Stock Market', description: 'Vanguard Total International Stock Index Fund Admiral', asset_type: 'FUND', weights: { 'Developed Market': 0.75, 'Emerging Market': 0.25 }, is_core: true,  index_tracked: 'FTSE Global All Cap ex US Index' },
    { ticker: 'IXUS',  canonical: 'Total Intl Stock Market', description: 'iShares Core MSCI Total International Stock ETF',       asset_type: 'ETF',  weights: { 'Developed Market': 0.75, 'Emerging Market': 0.25 }, is_core: true,  index_tracked: 'MSCI ACWI ex USA IMI Index' },
    { ticker: 'VXUS',  canonical: 'Total Intl Stock Market', description: 'Vanguard Total International Stock ETF',                asset_type: 'ETF',  weights: { 'Developed Market': 0.75, 'Emerging Market': 0.25 }, is_core: false, index_tracked: '' },
    // DEVELOPED MARKETS
    { ticker: 'VTMGX', canonical: 'Developed Markets', description: 'Vanguard Developed Markets Index Fund Admiral',    asset_type: 'FUND', weights: { 'Developed Market': 1.0 }, is_core: true,  index_tracked: 'FTSE Developed All Cap ex US Index' },
    { ticker: 'FSPSX', canonical: 'Developed Markets', description: 'Fidelity International Index Fund',                 asset_type: 'FUND', weights: { 'Developed Market': 1.0 }, is_core: true,  index_tracked: 'MSCI EAFE Index' },
    { ticker: 'IDEV',  canonical: 'Developed Markets', description: 'iShares Core MSCI International Developed Mkt ETF',  asset_type: 'ETF',  weights: { 'Developed Market': 1.0 }, is_core: true,  index_tracked: 'MSCI WORLD ex USA IMI Index' },
    { ticker: 'IEFA',  canonical: 'Developed Markets', description: 'iShares Core MSCI EAFE ETF',                         asset_type: 'ETF',  weights: { 'Developed Market': 1.0 }, is_core: true,  index_tracked: 'MSCI EAFE IMI Index' },
    { ticker: 'VEA',   canonical: 'Developed Markets', description: 'Vanguard FTSE Developed Markets ETF',                asset_type: 'ETF',  weights: { 'Developed Market': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'FSIIX', canonical: 'Developed Markets', description: 'Fidelity International Index (legacy)',               asset_type: 'FUND', weights: { 'Developed Market': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'FSIVX', canonical: 'Developed Markets', description: 'Fidelity International Value (legacy)',               asset_type: 'FUND', weights: { 'Developed Market': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'BTMKX', canonical: 'Developed Markets', description: 'iShares MSCI EAFE International Index Fund Class K',  asset_type: 'FUND', weights: { 'Developed Market': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'SCHF',  canonical: 'Developed Markets', description: 'Schwab International Equity ETF',                    asset_type: 'ETF',  weights: { 'Developed Market': 1.0 }, is_core: false, index_tracked: '' },
    // EMERGING MARKETS
    { ticker: 'FPADX', canonical: 'Emerging Markets', description: 'Fidelity Emerging Markets Index Fund',           asset_type: 'FUND', weights: { 'Emerging Market': 1.0 }, is_core: true,  index_tracked: 'MSCI Emerging Markets Index' },
    { ticker: 'VEMAX', canonical: 'Emerging Markets', description: 'Vanguard Emerging Markets Stock Index Fund Admiral', asset_type: 'FUND', weights: { 'Emerging Market': 1.0 }, is_core: true,  index_tracked: 'FTSE Emerging Markets All Cap China A Index' },
    { ticker: 'IEMG',  canonical: 'Emerging Markets', description: 'iShares Core MSCI Emerging Markets ETF',          asset_type: 'ETF',  weights: { 'Emerging Market': 1.0 }, is_core: true,  index_tracked: 'MSCI Emerging Markets IMI Index' },
    { ticker: 'VWO',   canonical: 'Emerging Markets', description: 'Vanguard Emerging Markets Stock Index Fund ETF',  asset_type: 'ETF',  weights: { 'Emerging Market': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'SCHE',  canonical: 'Emerging Markets', description: 'Schwab Emerging Markets Equity ETF',              asset_type: 'ETF',  weights: { 'Emerging Market': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'IIF',   canonical: 'India Fund',       description: 'Morgan Stanley India Investment Fund Inc',        asset_type: 'ETF',  weights: { 'Emerging Market': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'EPHE',  canonical: 'Philippines ETF',  description: 'iShares MSCI Philippines ETF',                   asset_type: 'ETF',  weights: { 'Emerging Market': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'THD',   canonical: 'Thailand ETF',     description: 'iShares MSCI Thailand ETF',                      asset_type: 'ETF',  weights: { 'Emerging Market': 1.0 }, is_core: false, index_tracked: '' },
    // INTL SMALL CAP / VALUE
    { ticker: 'VSS',   canonical: "Int'l Small Cap",  description: 'Vanguard FTSE All-World ex-US Small-Cap Index ETF',  asset_type: 'ETF',  weights: { "Int'l Small Cap": 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'QUSOX', canonical: "Int'l Value",      description: 'Pear Tree Polaris Foreign Value Small Cap Fund',      asset_type: 'FUND', weights: { "Int'l Value": 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'EFV',   canonical: "Int'l Value",      description: 'iShares MSCI EAFE Value ETF',                          asset_type: 'ETF',  weights: { "Int'l Value": 1.0 }, is_core: false, index_tracked: '' },
    // REIT
    { ticker: 'FSRNX', canonical: 'US Real Estate', description: 'Fidelity Real Estate Index Fund',          asset_type: 'FUND', weights: { REIT: 1.0 }, is_core: true,  index_tracked: 'Dow Jones U.S. Select Real Estate Securities Index' },
    { ticker: 'FREL',  canonical: 'US Real Estate', description: 'Fidelity MSCI Real Estate Index ETF',      asset_type: 'ETF',  weights: { REIT: 1.0 }, is_core: true,  index_tracked: 'MSCI USA IMI Real Estate Index' },
    { ticker: 'USRT',  canonical: 'US Real Estate', description: 'iShares Core US REIT ETF',                 asset_type: 'ETF',  weights: { REIT: 1.0 }, is_core: true,  index_tracked: 'FTSE NAREIT Equity REITS Index' },
    { ticker: 'VGSLX', canonical: 'US Real Estate', description: 'Vanguard Real Estate Index Fund Admiral',  asset_type: 'FUND', weights: { REIT: 1.0 }, is_core: true,  index_tracked: 'MSCI US Investable Market Real Estate 25/50 Index' },
    { ticker: 'VNQ',   canonical: 'US Real Estate', description: 'Vanguard Real Estate Index Fund ETF',      asset_type: 'ETF',  weights: { REIT: 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VNQI',  canonical: 'Intl Real Estate', description: 'Vanguard Global ex-US Real Estate Index Fd ETF', asset_type: 'ETF',  weights: { REIT: 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'FSRVX', canonical: 'US Real Estate', description: 'Fidelity Real Estate (legacy)',             asset_type: 'FUND', weights: { REIT: 1.0 }, is_core: false, index_tracked: '' },
    // HEALTHCARE
    { ticker: 'VGHCX', canonical: 'Healthcare', description: 'Vanguard Health Care Fund Investor Shares', asset_type: 'FUND', weights: { Healthcare: 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VGHAX', canonical: 'Healthcare', description: 'Vanguard Health Care Fund Admiral Shares',  asset_type: 'FUND', weights: { Healthcare: 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VHT',   canonical: 'Healthcare', description: 'Vanguard Health Care ETF',                  asset_type: 'ETF',  weights: { Healthcare: 1.0 }, is_core: false, index_tracked: '' },
    // ENERGY / COMMODITIES
    { ticker: 'VGENX', canonical: 'Energy',      description: 'Vanguard Energy Fund Investor Shares',        asset_type: 'FUND', weights: { Energy: 1.0 },      is_core: false, index_tracked: '' },
    { ticker: 'PSPFX', canonical: 'Commodities', description: 'U.S. Global Investors Global Resources Fund', asset_type: 'FUND', weights: { Commodities: 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'WOOD',  canonical: 'Timber',      description: 'iShares Global Timber & Forestry ETF',         asset_type: 'ETF',  weights: { Commodities: 1.0 }, is_core: false, index_tracked: '' },
    // US AGGREGATE BOND
    { ticker: 'FXNAX', canonical: 'Total US Bond', description: 'Fidelity U.S. Bond Index Fund',                     asset_type: 'FUND', weights: { 'US Aggregate Bond': 1.0 }, is_core: true,  index_tracked: 'Bloomberg U.S. Aggregate Bond Index' },
    { ticker: 'VBTLX', canonical: 'Total US Bond', description: 'Vanguard Total Bond Market Index Fund Admiral',     asset_type: 'FUND', weights: { 'US Aggregate Bond': 1.0 }, is_core: true,  index_tracked: 'Bloomberg U.S. Aggregate Float Adjusted Index' },
    { ticker: 'AGG',   canonical: 'Total US Bond', description: 'iShares Core US Aggregate Bond ETF',               asset_type: 'ETF',  weights: { 'US Aggregate Bond': 1.0 }, is_core: true,  index_tracked: 'Bloomberg US Aggregate Bond Index' },
    { ticker: 'BND',   canonical: 'Total US Bond', description: 'Vanguard Total Bond Market ETF',                   asset_type: 'ETF',  weights: { 'US Aggregate Bond': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'VBIRX', canonical: 'Total US Bond', description: 'Vanguard Short-Term Bond Index Fund Admiral',      asset_type: 'FUND', weights: { 'US Aggregate Bond': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'BMOIX', canonical: 'US Agg Bond Institutional', description: 'iShares U.S. Aggregate Bond Index Fund Institutional', asset_type: 'FUND', weights: { 'US Aggregate Bond': 1.0 }, is_core: false, index_tracked: '' },
    { ticker: 'FPMAX', canonical: 'Municipal Bond', description: 'First Eagle Core Plus Municipal Fund Class A',    asset_type: 'FUND', weights: { 'US Aggregate Bond': 1.0 }, is_core: false, index_tracked: '' },
    // EX-US AGGREGATE BOND
    { ticker: 'FBIIX', canonical: 'Intl Bond', description: 'Fidelity International Bond Index Fund',               asset_type: 'FUND', weights: { 'ex-US Aggregate Bond': 1.0 }, is_core: true, index_tracked: 'Bloomberg Global Aggregate ex-Float Adjusted RIC Diversified Index' },
    { ticker: 'VTABX', canonical: 'Intl Bond', description: 'Vanguard Total International Bond Index Fund Admiral', asset_type: 'FUND', weights: { 'ex-US Aggregate Bond': 1.0 }, is_core: true, index_tracked: 'Bloomberg Global Aggregate ex-Float-Adjusted Index' },
    { ticker: 'IAGG',  canonical: 'Intl Bond', description: 'iShares Core International Aggregate Bond ETF',        asset_type: 'ETF',  weights: { 'ex-US Aggregate Bond': 1.0 }, is_core: true, index_tracked: 'Bloomberg Global Aggregate ex 10% Issuer Capped Index' },
    // SHORT-TERM TREASURY
    { ticker: 'FUMBX', canonical: 'Short-Term Treasury', description: 'Fidelity Short-Term Treasury Bond Index Fund',    asset_type: 'FUND', weights: { 'Short-Term Treasury': 1.0 }, is_core: true, index_tracked: 'Bloomberg 1-5 Year U.S. Treasury Bond Index' },
    { ticker: 'VSBSX', canonical: 'Short-Term Treasury', description: 'Vanguard Short-Term Treasury Index Fund Admiral', asset_type: 'FUND', weights: { 'Short-Term Treasury': 1.0 }, is_core: true, index_tracked: 'Bloomberg US Treasury 1-3 Year Bond Index' },
    { ticker: 'SHY',   canonical: 'Short-Term Treasury', description: 'iShares 1-3 Year Treasury Bond ETF',              asset_type: 'ETF',  weights: { 'Short-Term Treasury': 1.0 }, is_core: true, index_tracked: 'ICE U.S. Treasury 1-3 Year Bond Index' },
    // INTERMEDIATE-TERM TREASURY
    { ticker: 'FUAMX', canonical: 'Intermediate Treasury', description: 'Fidelity Intermediate Treasury Bond Index Fund',    asset_type: 'FUND', weights: { 'Intermediate-Term Treasury': 1.0 }, is_core: true, index_tracked: 'Bloomberg 5-10 Year U.S. Treasury Bond Index' },
    { ticker: 'VSIGX', canonical: 'Intermediate Treasury', description: 'Vanguard Intermediate-Term Treasury Index Fund Admiral', asset_type: 'FUND', weights: { 'Intermediate-Term Treasury': 1.0 }, is_core: true, index_tracked: 'Bloomberg US Treasury 3-10 Year Bond Index' },
    { ticker: 'IEF',   canonical: 'Intermediate Treasury', description: 'iShares 7-10 Year Treasury Bond ETF',               asset_type: 'ETF',  weights: { 'Intermediate-Term Treasury': 1.0 }, is_core: true, index_tracked: 'ICE U.S. Treasury 7-10 Year Bond Index' },
    { ticker: 'IEI',   canonical: 'Intermediate Treasury', description: 'iShares 3-7 Year Treasury Bond ETF',                asset_type: 'ETF',  weights: { 'Intermediate-Term Treasury': 1.0 }, is_core: true, index_tracked: 'ICE U.S. Treasury 3-7 Year Bond Index' },
    // LONG-TERM TREASURY
    { ticker: 'FNBGX', canonical: 'Long-Term Treasury', description: 'Fidelity Long-Term Treasury Bond Index Fund',    asset_type: 'FUND', weights: { 'Long-Term Treasury': 1.0 }, is_core: true, index_tracked: 'Bloomberg U.S. Long Treasury Index' },
    { ticker: 'VLGSX', canonical: 'Long-Term Treasury', description: 'Vanguard Long-Term Treasury Index Fund Admiral', asset_type: 'FUND', weights: { 'Long-Term Treasury': 1.0 }, is_core: true, index_tracked: 'Bloomberg US Long Treasury Bond Index' },
    { ticker: 'TLT',   canonical: 'Long-Term Treasury', description: 'iShares 20+ Year Treasury Bond ETF',             asset_type: 'ETF',  weights: { 'Long-Term Treasury': 1.0 }, is_core: true, index_tracked: 'ICE U.S. Treasury 20+ Year Bond Index' },
    { ticker: 'EDV',   canonical: 'Long-Term Treasury', description: 'Vanguard Extended Duration Treasury Index Fd ETF', asset_type: 'ETF',  weights: { 'Long-Term Treasury': 1.0 }, is_core: false, index_tracked: '' },
    // TIPS
    { ticker: 'FIPDX', canonical: 'TIPS', description: 'Fidelity Inflation-Protected Bond Index Fund',         asset_type: 'FUND', weights: { TIPS: 1.0 }, is_core: true, index_tracked: 'Bloomberg U.S. TIPS Index' },
    { ticker: 'VAIPX', canonical: 'TIPS', description: 'Vanguard Inflation-Protected Securities Fund Admiral', asset_type: 'FUND', weights: { TIPS: 1.0 }, is_core: true, index_tracked: '' },
    { ticker: 'TIP',   canonical: 'TIPS', description: 'iShares TIPS Bond ETF',                                asset_type: 'ETF',  weights: { TIPS: 1.0 }, is_core: true, index_tracked: 'Bloomberg U.S. TIPS Index' },
];

export function seedRegistry(db: InstanceType<typeof Database>) {
    // INSERT OR IGNORE: never overwrite existing rows so custom_er and any
    // manual edits are preserved across server restarts.
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO asset_registry (ticker, canonical, description, asset_type, weights, is_core, index_tracked)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const inserted = db.transaction(() => {
        let count = 0;
        for (const entry of REGISTRY) {
            const result = stmt.run(
                entry.ticker,
                entry.canonical,
                entry.description,
                entry.asset_type,
                JSON.stringify(entry.weights),
                entry.is_core ? 1 : 0,
                entry.index_tracked
            );
            if (result.changes > 0) count++;
        }
        return count;
    })();
    if (inserted > 0) console.log(`Asset registry seeded: ${inserted} new entries`);
}
