import { getSnapshotHeadline, getSnapshotRows, getSnapshotExpansion } from '@/lib/logic/snapshotBrowser';
import SnapshotTableClient from './SnapshotTableClient';

export const dynamic = 'force-dynamic';

function formatDate(date: string): string {
    const [year, month] = date.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(month) - 1]} ${year}`;
}

function fmtUSD(v: number): string {
    return `$${Math.round(v).toLocaleString()}`;
}

export default function SnapshotsPage() {
    const headline = getSnapshotHeadline();
    const rows = getSnapshotRows();

    // Pre-fetch all expansions server-side (local SQLite — fast)
    const expansions = Object.fromEntries(
        rows.map((row, index) => {
            const prevDate = rows[index + 1]?.snapshotDate ?? null;
            return [row.snapshotDate, getSnapshotExpansion(row.snapshotDate, prevDate)];
        })
    );

    return (
        <main className="min-h-screen bg-black text-white font-mono">
            <div className="page-container space-y-16 pb-48 pt-16">

                {/* Headline */}
                <section className="space-y-10">
                    <div className="border-b border-border pb-8">
                        <h1 className="text-ui-hero">SNAPSHOT HISTORY</h1>
                        <div className="text-ui-label !text-zinc-500 mt-2 uppercase tracking-[0.3em]">Historical Portfolio States & Ledger Points</div>
                    </div>

                    {headline ? (
                        <div className="grid grid-cols-3 gap-px bg-border border border-border rounded-sm overflow-hidden">
                            <div className="bg-black px-8 py-6 space-y-2">
                                <div className="ui-label text-zinc-500">First Snapshot</div>
                                <div className="ui-metric text-zinc-100">{formatDate(headline.firstDate)}</div>
                                <div className="ui-value text-zinc-600">{fmtUSD(headline.firstValue)}</div>
                            </div>
                            <div className="bg-black px-8 py-6 space-y-2">
                                <div className="ui-label text-zinc-500">Latest Snapshot</div>
                                <div className="ui-metric text-zinc-100">{formatDate(headline.latestDate)}</div>
                                <div className="ui-value text-zinc-600">{fmtUSD(headline.latestValue)}</div>
                            </div>
                            <div className="bg-black px-8 py-6 space-y-2">
                                <div className="ui-label text-zinc-500">Total Growth</div>
                                <div className={`ui-metric ${headline.growthDollars >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {headline.growthDollars >= 0 ? '+' : ''}{fmtUSD(headline.growthDollars)}
                                </div>
                                <div className="ui-value text-zinc-600">
                                    ({headline.growthDollars >= 0 ? '+' : ''}{(headline.growthPct * 100).toFixed(1)}%) over {headline.monthsElapsed} months
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="px-6 py-4 border border-zinc-900 rounded-sm ui-caption text-zinc-700 italic">
                            {rows.length === 0
                                ? 'No snapshots yet. Import holdings to begin.'
                                : 'Import a second snapshot to see growth comparison.'}
                        </div>
                    )}
                </section>

                {/* Table */}
                {rows.length > 0 && (
                    <section className="space-y-8">
                        <div className="ui-label text-zinc-500">All Snapshots</div>
                        <SnapshotTableClient rows={rows} expansions={expansions} />
                    </section>
                )}
            </div>
        </main>
    );
}
