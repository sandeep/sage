'use client';

import React, { useEffect, useState } from 'react';
import { StrategicMoveRow } from './TaskBlotter';
import { AuditSnapshot } from '@/lib/logic/auditService';

interface ForensicAuditPaneProps {
    selectedMove: StrategicMoveRow | null;
    onClose: () => void;
}

export default function ForensicAuditPane({ selectedMove, onClose }: ForensicAuditPaneProps) {
    const [auditTrail, setAuditTrail] = useState<AuditSnapshot[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!selectedMove || !selectedMove.assetClass) {
            setAuditTrail([]);
            return;
        }

        const fetchAudit = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/audit?id=${encodeURIComponent(selectedMove.assetClass!)}`);
                if (res.ok) {
                    const data = await res.json();
                    setAuditTrail(data);
                }
            } catch (err) {
                console.error("Failed to fetch audit trail", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAudit();
    }, [selectedMove]);

    if (!selectedMove) return null;

    // Sort ascending for chronological representation: oldest (baseline) to newest (current)
    const chronologicalTrail = [...auditTrail].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const baseline = chronologicalTrail.length > 0 ? chronologicalTrail[0] : null;
    const current = chronologicalTrail.length > 0 ? chronologicalTrail[chronologicalTrail.length - 1] : null;

    return (
        <div className="fixed inset-y-0 right-0 w-[400px] bg-zinc-950 border-l border-zinc-800 z-50 transform transition-transform shadow-2xl overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-zinc-900">
                <h3 className="ui-label text-zinc-300 uppercase tracking-widest">Forensic Audit</h3>
                <button onClick={onClose} className="text-zinc-500 hover:text-white ui-label cursor-pointer p-2">✕</button>
            </div>
            
            <div className="p-6 space-y-8">
                <div>
                    <p className="text-sm font-bold text-white mb-1">{selectedMove.headline}</p>
                    <p className="text-xs text-zinc-500 mb-1">Asset Class: {selectedMove.assetClass || 'N/A'}</p>
                    <p className="text-xs text-zinc-500">Status: {selectedMove.status}</p>
                    <p className="text-xs mt-2 text-zinc-400">Total Move Amount: <span className="text-emerald-500 font-bold">${selectedMove.totalAmount.toLocaleString()}</span></p>
                </div>

                {loading ? (
                    <div className="p-4 border border-zinc-900 border-dashed rounded-sm text-center">
                        <p className="text-xs italic text-zinc-600">Retrieving historical snapshots...</p>
                    </div>
                ) : chronologicalTrail.length > 0 ? (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-black border-b border-zinc-900 pb-1">Data Trail</h4>
                            <div className="space-y-3 mt-4">
                                {chronologicalTrail.map((snapshot, idx) => {
                                    const isBaseline = idx === 0;
                                    const isCurrent = idx === chronologicalTrail.length - 1;
                                    
                                    return (
                                        <div key={snapshot.date} className="flex justify-between items-center bg-zinc-900/30 p-3 rounded-sm border border-zinc-800/50">
                                            <div>
                                                <div className="text-xs text-zinc-300">{snapshot.date}</div>
                                                <div className="text-[10px] text-zinc-500 font-bold uppercase">
                                                    {isBaseline ? 'Baseline' : isCurrent ? 'Current' : 'Snapshot'}
                                                </div>
                                            </div>
                                            <div className="text-sm text-white font-mono tabular-nums">
                                                ${Math.round(snapshot.market_value).toLocaleString()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 border border-zinc-900 border-dashed rounded-sm text-center">
                        <p className="text-xs italic text-zinc-600">No historical data found for {selectedMove.assetClass}.</p>
                    </div>
                )}

                <div className="space-y-2">
                    <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-black border-b border-zinc-900 pb-1">The Why (Reasoning)</h4>
                    <div className="bg-zinc-900/20 p-4 rounded-sm border border-zinc-800/50 mt-4 space-y-4">
                        {Object.values(selectedMove.cells).map(cell => (
                            <div key={cell.account_id} className="space-y-2">
                                <div className="text-[10px] uppercase text-zinc-500 font-bold">{cell.account_id}</div>
                                {cell.directives.map(d => (
                                    <div key={d.id} className="text-xs text-zinc-400">
                                        <span className="text-zinc-300">{d.type}</span>: {d.description || `Execute ${d.type} of ${d.amount ? '$' + d.amount.toLocaleString() : 'required amount'} for ${d.target_asset_class || d.link_key || 'optimization'}.`}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
