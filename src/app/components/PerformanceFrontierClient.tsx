'use client';
import dynamic from 'next/dynamic';
import { Coordinates } from '@/lib/types/audit';

// Use standard Next.js dynamic import to force client-only rendering
// This is the only reliable way to prevent Recharts hydration errors.
const PerformanceFrontier = dynamic(() => import('./PerformanceFrontier'), {
    ssr: false,
    loading: () => (
        <div className="bg-zinc-950 border border-zinc-900 rounded-sm p-8 min-h-[650px] animate-pulse flex items-center justify-center">
            <div className="text-zinc-800 text-xs font-black uppercase tracking-widest font-mono">Initializing Efficiency Map...</div>
        </div>
    )
});

export default function PerformanceFrontierClient({ coordinates }: { coordinates: { vti: Coordinates; target: Coordinates; actual: Coordinates } }) {
    return (
        <div className="w-full bg-zinc-950/50 rounded-sm shadow-2xl">
            <PerformanceFrontier coordinates={coordinates} />
        </div>
    );
}
