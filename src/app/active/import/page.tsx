import ImportClient from './ImportClient';

export default function AlphaImportPage() {
    return (
        <div className="p-10 max-w-5xl mx-auto space-y-10">
            <div className="space-y-1">
                <h1 className="text-3xl font-black uppercase tracking-tighter text-indigo-500 italic">Alpha Import</h1>
                <p className="text-xs text-zinc-500 uppercase font-black tracking-widest font-mono">
                    Ingest Robinhood Transaction CSVs and Statement PDFs
                </p>
            </div>
            <ImportClient />
        </div>
    );
}