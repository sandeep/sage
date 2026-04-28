'use client';

import { useEffect, useState, useCallback } from 'react';
import AllocationBeforeAfter from './AllocationBeforeAfter';
import AllocationDriftChart from './AllocationDriftChart';
import AllocationHeader from './Allocation/AllocationHeader';
import AllocationNodeRow from './Allocation/AllocationNodeRow';
import { flattenLeafWeights } from '@/lib/logic/allocationSimulator';

// ── types ─────────────────────────────────────────────────────────────────────

interface HistoryPoint {
    id: number;
    date: string;
    label: string;
    expectedCagr: number;
    stockWeight: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function computeExpectedCagr(tree: Record<string, any>): number {
    let cagrSum = 0;
    function walk(node: any) {
        if (node.expected_return != null) cagrSum += node.weight * node.expected_return;
        Object.values(node.categories ?? {}).forEach(walk);
        Object.values(node.subcategories ?? {}).forEach(walk);
    }
    Object.values(tree).forEach(walk);
    return cagrSum;
}

function computeStockWeight(tree: Record<string, any>): number {
    return (tree['Stock']?.weight as number) ?? 0;
}

function computeTopLevelSum(tree: Record<string, any>): number {
    return Object.values(tree).reduce((sum: number, node: any) => sum + (node.weight ?? 0), 0);
}

function updateLeafWeight(
    tree: Record<string, any>,
    targetLabel: string,
    newWeight: number
): Record<string, any> {
    function walkUpdate(node: any): any {
        const updatedCats = node.categories
            ? Object.fromEntries(
                Object.entries(node.categories).map(([l, d]) => [
                    l,
                    l === targetLabel ? { ...(d as any), weight: newWeight } : walkUpdate(d),
                ])
              )
            : undefined;
        const updatedSubs = node.subcategories
            ? Object.fromEntries(
                Object.entries(node.subcategories).map(([l, d]) => [
                    l,
                    l === targetLabel ? { ...(d as any), weight: newWeight } : walkUpdate(d),
                ])
              )
            : undefined;
        return {
            ...node,
            ...(updatedCats ? { categories: updatedCats } : {}),
            ...(updatedSubs ? { subcategories: updatedSubs } : {}),
        };
    }
    return Object.fromEntries(
        Object.entries(tree).map(([l, d]) => [
            l,
            l === targetLabel ? { ...(d as any), weight: newWeight } : walkUpdate(d),
        ])
    );
}

function writeDraftToSession(tree: Record<string, any>) {
    try {
        const flat = flattenLeafWeights(tree);
        sessionStorage.setItem('sage_draft_allocation', JSON.stringify(flat));
    } catch {
        // sessionStorage not available (SSR edge case)
    }
}

// ── main component ────────────────────────────────────────────────────────────

export default function AllocationEditor() {
    const [originalTree, setOriginalTree] = useState<Record<string, any> | null>(null);
    const [draftTree, setDraftTree]       = useState<Record<string, any> | null>(null);
    const [actualWeights, setActualWeights] = useState<Record<string, number>>({});
    const [saving, setSaving]             = useState(false);
    const [saveError, setSaveError]       = useState('');
    const [saveSuccess, setSaveSuccess]   = useState(false);
    const [history, setHistory]           = useState<HistoryPoint[]>([]);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        Stock: true, Bond: false, Cash: false,
    });

    useEffect(() => {
        fetch('/api/admin/allocation')
            .then(r => r.json())
            .then((tree: Record<string, any>) => {
                setOriginalTree(tree);
                setDraftTree(structuredClone(tree));
            });
        fetch('/api/admin/allocation/history')
            .then(r => r.json())
            .then(setHistory);
        fetch('/api/admin/actual-weights')
            .then(r => r.json())
            .then(setActualWeights);
    }, []);

    const handleSliderChange = useCallback((label: string, newWeight: number) => {
        setDraftTree(prev => {
            if (!prev) return prev;
            const next = updateLeafWeight(prev, label, newWeight);
            writeDraftToSession(next);
            return next;
        });
        setSaveSuccess(false);
    }, []);

    const handleTopLevelSliderChange = useCallback((label: string, newWeight: number) => {
        setDraftTree(prev => {
            if (!prev) return prev;
            const next = { ...prev, [label]: { ...(prev[label] as any), weight: newWeight } };
            writeDraftToSession(next);
            return next;
        });
        setSaveSuccess(false);
    }, []);

    const handleReset = async () => {
        setSaving(true);
        try {
            const r = await fetch('/api/admin/allocation');
            const tree = await r.json();
            setOriginalTree(tree);
            setDraftTree(structuredClone(tree));
            setSaveSuccess(false);
            setSaveError('');
        } catch (e) {
            setSaveError('Failed to refresh original strategy');
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = useCallback((): boolean => {
        if (!originalTree || !draftTree) return false;
        return JSON.stringify(originalTree) !== JSON.stringify(draftTree);
    }, [originalTree, draftTree]);

    const handleAccept = async () => {
        if (!draftTree) return;
        
        // ── SAVE GUARD: SUM MUST BE 100% ───────────────────────────────────
        const currentSum = computeTopLevelSum(draftTree);
        if (Math.abs(currentSum - 1.0) > 1e-6) {
            setSaveError(`Strategy Integrity Error: Total weight must be exactly 100.0% (Current: ${(currentSum * 100).toFixed(2)}%)`);
            return;
        }

        setSaving(true); setSaveError(''); setSaveSuccess(false);
        const res = await fetch('/api/admin/allocation', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draftTree),
        });
        const json = await res.json();
        if (!res.ok) {
            setSaveError(json.error ?? 'Save failed');
        } else {
            setOriginalTree(structuredClone(draftTree));
            setSaveSuccess(true);
        }
        setSaving(false);
    };

    if (!draftTree || !originalTree) {
        return <div className="text-zinc-500 p-16 font-mono text-[11px] animate-pulse uppercase tracking-[0.4em]">Initializing Architect...</div>;
    }

    const origCagr    = computeExpectedCagr(originalTree);
    const draftCagr   = computeExpectedCagr(draftTree);
    const origStock   = computeStockWeight(originalTree);
    const draftStock  = computeStockWeight(draftTree);
    const topLevelSum = computeTopLevelSum(draftTree);

    return (
        <main className="min-h-screen bg-black text-white font-mono p-16">
            <div className="max-w-[1400px] mx-auto space-y-16">
                
                <AllocationHeader 
                    hasChanges={hasChanges()} 
                    onReset={handleReset}
                    saveError={saveError}
                    saveSuccess={saveSuccess}
                />

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-16">
                    <div className="xl:col-span-2 space-y-2">
                        {Object.entries(draftTree).map(([topLabel, topNode]) => (
                            <AllocationNodeRow
                                key={topLabel}
                                topLabel={topLabel}
                                topNode={topNode as any}
                                actualWeights={actualWeights}
                                isOpen={openSections[topLabel] ?? false}
                                onToggleOpen={() => setOpenSections(prev => ({ ...prev, [topLabel]: !prev[topLabel] }))}
                                onSliderChange={handleSliderChange}
                                onTopLevelSliderChange={handleTopLevelSliderChange}
                            />
                        ))}
                    </div>
                    <div className="space-y-12">
                        <div className="text-ui-label text-zinc-500 mb-8 border-b border-zinc-900 pb-6">Impact Analysis</div>
                        <AllocationBeforeAfter
                            origCagr={origCagr} draftCagr={draftCagr}
                            origStock={origStock} draftStock={draftStock}
                            topLevelSum={topLevelSum} saving={saving}
                            hasChanges={hasChanges()} onAccept={handleAccept}
                        />
                        <div className="pt-8 border-t border-zinc-900">
                            <div className="text-ui-label text-zinc-500 mb-8">Drift History</div>
                            <AllocationDriftChart history={history} />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
