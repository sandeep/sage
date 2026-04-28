'use client';
import { useMemo, useState, useRef, useEffect } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

interface ForensicNode {
    id: string;
    name: string;
    type: 'account' | 'ticker';
    assetType?: string;
    totalValue: number;
}

interface ForensicLink {
    source: string;
    target: string;
    value: number;
    assetType: string;
}

interface Props {
    nodes: ForensicNode[];
    links: ForensicLink[];
}

const ASSET_COLORS: Record<string, string> = {
    EQUITY: 'var(--accent)', 
    BOND: 'var(--yield)',   
    FIXED_INCOME: 'var(--yield)', 
    CASH: 'var(--liquidity)',   
    OPTION: 'var(--derivative)', 
};

const DEFAULT_COLOR = 'var(--zinc-meta)'; 

export default function ForensicSankey({ nodes, links }: Props) {
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width } = entry.contentRect;
                setDimensions({
                    width: width,
                    height: Math.max(500, nodes.length * 30)
                });
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [nodes.length]);

    const { graph, selectedAccountInfo } = useMemo(() => {
        if (nodes.length === 0) return { graph: null, selectedAccountInfo: null };

        const sankeyLayout = sankey<ForensicNode, ForensicLink>()
            .nodeId(d => d.id)
            .nodeWidth(12)
            .nodePadding(12)
            .extent([[150, 10], [dimensions.width - 150, dimensions.height - 10]]);

        const nodesCopy = nodes.map(n => ({ ...n }));
        const linksCopy = links.map(l => ({ ...l }));

        const graph = sankeyLayout({ nodes: nodesCopy as any, links: linksCopy as any });

        let selectedAccountInfo = null;
        if (selectedAccountId) {
            const accountNode = nodes.find(n => n.id === selectedAccountId);
            const sumOfLinks = links
                .filter(l => l.source === selectedAccountId)
                .reduce((acc, l) => acc + l.value, 0);
            
            if (accountNode) {
                selectedAccountInfo = {
                    targetBalance: accountNode.totalValue,
                    sumOfLinks,
                    isReconciled: Math.abs(accountNode.totalValue - sumOfLinks) < 0.01,
                    name: accountNode.name
                };
            }
        }

        return { graph, selectedAccountInfo };
    }, [nodes, links, dimensions, selectedAccountId]);

    if (!graph) return null;

    const formatCurrency = (val: number) => 
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    return (
        <div ref={containerRef} className="w-full relative border border-border bg-card/20 rounded-lg p-4 overflow-hidden">
                <svg width={dimensions.width} height={dimensions.height} className="overflow-visible">
                    {/* Links */}
                    <g>
                        {graph.links.map((link: any, i: number) => {
                            const opacity = selectedAccountId 
                                ? (link.source.id === selectedAccountId ? 0.8 : 0.05)
                                : 0.2;
                            
                            const color = ASSET_COLORS[link.assetType] || DEFAULT_COLOR;

                            return (
                                <path
                                    key={`link-${i}`}
                                    d={sankeyLinkHorizontal()(link) || ''}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth={Math.max(1, link.width)}
                                    opacity={opacity}
                                    className="transition-all duration-300"
                                />
                            );
                        })}
                    </g>

                    {/* Nodes */}
                    <g>
                        {graph.nodes.map((node: any) => {
                            const isAccount = node.type === 'account';
                            const isSelected = selectedAccountId === node.id;
                            const isDimmed = selectedAccountId && !isSelected && isAccount;
                            
                            // For tickers, dim if no links from selected account
                            const hasContributionFromSelected = selectedAccountId && 
                                links.some(l => l.source === selectedAccountId && l.target === node.id);
                            
                            const tickerDimmed = selectedAccountId && !isAccount && !hasContributionFromSelected;
                            const finalDimmed = isAccount ? isDimmed : tickerDimmed;

                            const contributionValue = isAccount ? null : (
                                selectedAccountId ? links.find(l => l.source === selectedAccountId && l.target === node.id)?.value : null
                            );

                            return (
                                <g 
                                    key={node.id} 
                                    className={`cursor-pointer transition-all duration-300 outline-none ${isAccount ? 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2' : ''} ${finalDimmed ? 'opacity-20' : 'opacity-100'}`}
                                    onClick={() => isAccount && setSelectedAccountId(isSelected ? null : node.id)}
                                    tabIndex={isAccount ? 0 : undefined}
                                    role={isAccount ? "button" : undefined}
                                    aria-label={isAccount ? `${isSelected ? 'Deselect' : 'Select'} ${node.name} account` : undefined}
                                    onKeyDown={(e) => {
                                        if (isAccount && (e.key === 'Enter' || e.key === ' ')) {
                                            e.preventDefault();
                                            setSelectedAccountId(isSelected ? null : node.id);
                                        }
                                    }}
                                >
                                    <rect
                                        x={node.x0}
                                        y={node.y0}
                                        width={node.x1 - node.x0}
                                        height={Math.max(2, node.y1 - node.y0)}
                                        fill={isAccount ? 'var(--zinc-truth)' : (ASSET_COLORS[node.assetType] || DEFAULT_COLOR)}
                                        rx={1}
                                    />
                                    
                                    {/* Account Labels (Left) */}
                                    {isAccount && (
                                        <text
                                            x={node.x0 - 12}
                                            y={(node.y0 + node.y1) / 2}
                                            textAnchor="end"
                                            className="font-mono"
                                        >
                                            <tspan x={node.x0 - 12} dy="-0.2em" className="fill-truth text-[10px] font-bold">{node.name}</tspan>
                                            <tspan x={node.x0 - 12} dy="1.2em" className="fill-meta text-[9px]">{formatCurrency(node.totalValue)}</tspan>
                                        </text>
                                    )}

                                    {/* Ticker Labels (Right) */}
                                    {!isAccount && (
                                        <>
                                            {/* Contribution Label (Left of bar) */}
                                            {contributionValue !== undefined && contributionValue !== null && (
                                                <text
                                                    x={node.x0 - 8}
                                                    y={(node.y0 + node.y1) / 2}
                                                    textAnchor="end"
                                                    dy="0.35em"
                                                    className="fill-accent text-[10px] font-mono font-bold transition-opacity duration-500"
                                                >
                                                    +{formatCurrency(contributionValue)}
                                                </text>
                                            )}

                                            {/* Identity + Total (Right of bar) */}
                                            <text
                                                x={node.x1 + 12}
                                                y={(node.y0 + node.y1) / 2}
                                                textAnchor="start"
                                                className="font-mono"
                                            >
                                                <tspan x={node.x1 + 12} dy="-0.2em" className="fill-truth text-[10px] font-bold">{node.id}</tspan>
                                                <tspan x={node.x1 + 12} dy="1.2em" className="fill-meta text-[9px]">{formatCurrency(node.totalValue)}</tspan>
                                            </text>
                                        </>
                                    )}
                                </g>
                            );
                        })}
                    </g>
                </svg>

                {/* Reconciliation Footer */}
                {selectedAccountInfo && (
                    <div className="absolute bottom-0 left-0 right-0 bg-card/90 border-t border-border p-3 flex items-center justify-between transition-all duration-300">
                        <div className="flex gap-8 items-center">
                            <div>
                                <p className="text-[8px] uppercase tracking-widest text-meta mb-0.5">Focusing Account</p>
                                <p className="text-xs font-mono font-bold text-foreground">{selectedAccountInfo.name}</p>
                            </div>
                            <div>
                                <p className="text-[8px] uppercase tracking-widest text-meta mb-0.5">Target Balance</p>
                                <p className="text-xs font-mono text-truth">{formatCurrency(selectedAccountInfo.targetBalance)}</p>
                            </div>
                            <div>
                                <p className="text-[8px] uppercase tracking-widest text-meta mb-0.5">Sum of Links</p>
                                <p className="text-xs font-mono text-truth">{formatCurrency(selectedAccountInfo.sumOfLinks)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
    );
}
