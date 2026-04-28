'use client';
import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../WorkspaceContext';

export default function SyncModal() {
    const { isSyncOpen, setSyncOpen, activeConsole } = useWorkspace();
    
    const [csvData, setCsvData] = useState('');
    const [step, setStep] = useState<1 | 2>(1); // 1: Drop, 2: Confirm
    const [parseResult, setParseResult] = useState<any>(null);
    const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isSyncOpen) {
            setStep(1);
            setCsvData('');
            setParseResult(null);
            setStatus(null);
            setSnapshotDate(new Date().toISOString().split('T')[0]);
        }
    }, [isSyncOpen]);

    if (!isSyncOpen) return null;

    const handleFile = async (file: File) => {
        try {
            const text = await file.text();
            setCsvData(text);
            setLoading(true);
            const res = await fetch('/api/upload/parse', {
                method: 'POST',
                body: JSON.stringify({ csvData: text })
            });
            const data = await res.json();
            if (data.error) {
                setStatus({ msg: data.error, type: 'error' });
            } else if (!data.holdings || data.holdings.length === 0) {
                setStatus({ msg: 'No valid holdings detected in this file.', type: 'error' });
            } else {
                setParseResult(data);
                setStep(2);
                setStatus(null);
            }
        } catch (err) {
            setStatus({ msg: 'Failed to read file.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    };

    const handleCommit = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: JSON.stringify({ 
                    csvData, 
                    accountId: 'MULTI_UPLOAD',
                    snapshotDate 
                })
            });
            const data = await res.json();
            if (data.success) {
                // Success Action: Close modal and reload
                setSyncOpen(false);
                window.location.reload();
            } else {
                setStatus({ msg: data.error || 'Upload failed', type: 'error' });
            }
        } catch (e: any) {
            setStatus({ msg: 'Network error', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const fmtUSD = (v: number) => `$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const dropzoneText = activeConsole === 'portfolio' ? 'Drop Fidelity / Schwab CSV' : 'Drop Robinhood CSV';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
                onClick={() => setSyncOpen(false)}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-900 rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Close Button */}
                <button 
                    onClick={() => setSyncOpen(false)}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white z-50 p-2 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Step Content */}
                {step === 1 ? (
                    <div className="p-10 space-y-10">
                        <div className="flex justify-between items-center border-b border-zinc-900 pb-6">
                            <div className="space-y-1">
                                <div className="text-xl font-black uppercase tracking-tighter text-white italic">
                                    Sync Fidelity 360 Data
                                </div>
                                <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest font-mono">
                                    Forensic Fidelity 360 Ingest Pipeline
                                </div>
                            </div>
                        </div>

                        <div 
                            className={`
                                relative border-2 border-dashed rounded-sm p-20 transition-all duration-300 flex flex-col items-center justify-center space-y-6
                                ${isDragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/10 hover:border-zinc-700'}
                                ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                            onDrop={(e) => { 
                                e.preventDefault(); 
                                setIsDragging(false);
                                if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
                            }}
                        >
                            <input 
                                type="file" 
                                accept=".csv"
                                onChange={onFileChange}
                                disabled={loading}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            />
                            
                            <div className="text-center space-y-4 pointer-events-none">
                                <div className="bg-zinc-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className={`w-6 h-6 ${isDragging ? 'text-emerald-500' : 'text-zinc-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-200">
                                    {loading ? 'Analyzing CSV...' : dropzoneText}
                                </p>
                                {status?.msg && (
                                    <p className="text-[10px] text-rose-500 uppercase font-black tracking-widest">{status.msg}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <button
                                onClick={() => setSyncOpen(false)}
                                className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
                            >
                                Close Modal
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center border-b border-zinc-900 pb-6">
                            <div className="space-y-1">
                                <div className="text-xl font-black uppercase tracking-tighter text-emerald-500 italic">Spot Check Required</div>
                                <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest font-mono">Verify aggregate totals before ledger commitment</div>
                            </div>
                            <div className="text-right">
                                <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest block mb-1">Snapshot Date</label>
                                <input 
                                    type="date" 
                                    value={snapshotDate}
                                    onChange={(e) => setSnapshotDate(e.target.value)}
                                    className="bg-black border border-zinc-800 text-xs font-mono px-3 py-1 rounded-sm text-zinc-300 focus:border-emerald-500 outline-none transition-colors"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                            {parseResult?.detectedAccounts.map((acc: any) => {
                                const total = parseResult.accountTotals[acc.id] || 0;
                                const count = parseResult.holdings.filter((h: any) => h.accountId === acc.id).length;

                                return (
                                    <div key={acc.id} className="bg-zinc-900/20 border border-zinc-800 rounded-sm px-6 py-4 flex justify-between items-center group hover:border-zinc-700 transition-colors">
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-black text-zinc-200 uppercase tracking-tight">{acc.name}</div>
                                            <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{count} Assets Detected</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-white font-mono tracking-tighter">{fmtUSD(total)}</div>
                                            <div className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em]">Verified from CSV</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t border-zinc-900">
                            <button
                                onClick={() => setStep(1)}
                                className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
                            >
                                ← Cancel
                            </button>
                            <button
                                onClick={handleCommit}
                                disabled={loading}
                                className="px-12 py-4 text-xs font-black uppercase tracking-[0.2em] bg-emerald-600 text-white rounded-sm hover:bg-emerald-500 transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                            >
                                {loading ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                        {status?.msg && (
                            <p className="text-center text-[10px] text-rose-500 uppercase font-black tracking-widest">{status.msg}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
