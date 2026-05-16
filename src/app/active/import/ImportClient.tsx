'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportClient() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [status, setStatus] = useState<{ msg: string; type: 'error' | 'info' } | null>(null);

    const handleFiles = async (files: FileList | File[]) => {
        try {
            setLoading(true);
            setStatus({ msg: 'Processing files and recomputing Alpha Engine...', type: 'info' });
            
            const formData = new FormData();
            Array.from(files).forEach(file => formData.append('files', file));

            const res = await fetch('/api/alpha/import', {
                method: 'POST',
                body: formData
            });
            
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`[Upload] Server returned ${res.status}: ${errorText}`);
                setStatus({ msg: `Server Error (${res.status}): ${errorText.substring(0, 100)}`, type: 'error' });
                setLoading(false);
                return;
            }

            const data = await res.json();
            
            if (data.error) {
                setStatus({ msg: data.error, type: 'error' });
            } else {
                setResults(prev => [...data.results, ...prev]);
                setStatus(null);
            }
        } catch (err) {
            setStatus({ msg: 'Failed to upload files.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); 
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    return (
        <div className="space-y-8">
            <div 
                className={`
                    relative border-2 border-dashed rounded-sm p-24 transition-all duration-300 flex flex-col items-center justify-center space-y-6
                    ${isDragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-zinc-800 bg-zinc-900/10 hover:border-zinc-700'}
                    ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={handleDrop}
            >
                <input 
                    type="file" 
                    accept=".csv,.pdf"
                    multiple
                    onChange={onFileChange}
                    disabled={loading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                
                <div className="text-center space-y-4 pointer-events-none">
                    <div className="bg-zinc-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className={`w-8 h-8 ${isDragging ? 'text-indigo-500' : 'text-zinc-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-zinc-200">
                        {loading ? 'Processing Data...' : 'Drop Robinhood CSVs & PDFs Here'}
                    </p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                        Supports Transaction CSVs and Monthly Statements (Equity/Futures)
                    </p>
                </div>
            </div>

            {status?.msg && status.type === 'info' && (
                <div className="flex items-center justify-center gap-3 p-4 bg-indigo-900/20 border border-indigo-900/50 rounded-sm">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{status.msg}</span>
                </div>
            )}

            {status?.msg && status.type === 'error' && (
                <div className="p-4 bg-rose-900/20 border border-rose-900/50 rounded-sm text-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">{status.msg}</span>
                </div>
            )}

            {results.length > 0 && (
                <div className="space-y-4 animate-in fade-in duration-500">
                    <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Import Log</h2>
                    <div className="grid grid-cols-1 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {results.map((res, i) => (
                            <div key={i} className="bg-zinc-900/20 border border-zinc-800 rounded-sm px-6 py-4 flex justify-between items-center group">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        {res.status === 'OK' && <span className="text-emerald-500 font-black">✓</span>}
                                        {res.status === 'DUPLICATE_SKIPPED' && <span className="text-amber-500 font-black">⚠</span>}
                                        {res.status === 'ERROR' && <span className="text-rose-500 font-black">✗</span>}
                                        <span className="text-xs font-black text-zinc-200 uppercase tracking-tight">{res.fileName}</span>
                                    </div>
                                    <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-6">{res.fileType.replace('_', ' ')}</div>
                                </div>
                                <div className="text-right">
                                    {res.status === 'OK' ? (
                                        <div className="text-sm font-black text-white font-mono tracking-tighter">{res.recordsParsed} Records</div>
                                    ) : (
                                        <div className="text-xs font-black text-rose-500 font-mono uppercase">{res.status.replace('_', ' ')}</div>
                                    )}
                                    {res.errorMsg && <div className="text-[8px] font-black text-rose-500 uppercase tracking-[0.2em]">{res.errorMsg}</div>}
                                    {res.duplicatesCount > 0 && <div className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em]">{res.duplicatesCount} Duplicates Skipped</div>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={() => router.push('/active')}
                            className="px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] bg-indigo-600 text-white rounded-sm hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.2)]"
                        >
                            Return to Active Alpha
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}