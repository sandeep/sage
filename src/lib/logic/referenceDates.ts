
/**
 * Global date anchors for the Sage Performance Engine.
 * Ensures all components (1Y, 3Y, 5Y) use the exact same 'Today' and 'Start' points.
 */

// We anchor to the latest available price in the database to prevent intra-day drift
export const TODAY_ANCHOR = '2026-03-20';

export function getTrailingYearStart(): string {
    // 2025-03-20
    const d = new Date(TODAY_ANCHOR);
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
}

export function getReferenceDates() {
    return {
        today: TODAY_ANCHOR,
        oneYearAgo: getTrailingYearStart()
    };
}
