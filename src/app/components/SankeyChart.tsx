// src/app/components/SankeyChart.tsx
'use client';
import { useEffect, useRef } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

interface Node { id: string; label: string; type: 'account' | 'ticker' | 'category' | 'unaccounted'; }
interface Link { source: string; target: string; value: number; }

const NODE_COLORS: Record<string, string> = {
    account: '#10b981',
    ticker: '#6366f1',
    category: '#3b82f6',
    unaccounted: '#f59e0b',
};

export default function SankeyChart({ nodes, links }: { nodes: Node[]; links: Link[] }) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || nodes.length === 0) return;

        const width = svgRef.current.clientWidth || 900;
        const height = Math.max(400, nodes.length * 28);
        svgRef.current.setAttribute('height', String(height));

        // Use string IDs directly since .nodeId(d => d.id) is used below
        const validNodeIds = new Set(nodes.map(n => n.id));
        const sankeyNodes = nodes.map(n => ({ ...n, name: n.label }));
        const sankeyLinks = links
            .filter(l => validNodeIds.has(l.source) && validNodeIds.has(l.target))
            .map(l => ({
                source: l.source, // Keep as string ID
                target: l.target, // Keep as string ID
                value: Math.max(l.value, 1),
            }));

        const sankeyLayout = sankey<any, any>()
            .nodeId(d => d.id)
            .nodeWidth(18)
            .nodePadding(10)
            .extent([[1, 1], [width - 1, height - 1]]);

        const graph = sankeyLayout({ nodes: sankeyNodes.map(n => ({ ...n })), links: sankeyLinks.map(l => ({ ...l })) });

        const svg = svgRef.current;
        svg.innerHTML = '';

        graph.links.forEach((link: any) => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', sankeyLinkHorizontal()(link) || '');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', NODE_COLORS[link.source.type] || '#4b5563');
            path.setAttribute('stroke-width', String(Math.max(1, link.width)));
            path.setAttribute('opacity', '0.3');
            svg.appendChild(path);
        });

        graph.nodes.forEach((node: any) => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', String(node.x0));
            rect.setAttribute('y', String(node.y0));
            rect.setAttribute('width', String(node.x1 - node.x0));
            rect.setAttribute('height', String(Math.max(1, node.y1 - node.y0)));
            rect.setAttribute('fill', NODE_COLORS[node.type] || '#4b5563');
            svg.appendChild(rect);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            const isRight = node.x0 > width / 2;
            text.setAttribute('x', String(isRight ? node.x0 - 4 : node.x1 + 4));
            text.setAttribute('y', String((node.y0 + node.y1) / 2));
            text.setAttribute('dy', '0.35em');
            text.setAttribute('text-anchor', isRight ? 'end' : 'start');
            text.setAttribute('fill', '#9ca3af');
            text.setAttribute('font-size', '10');
            text.setAttribute('font-family', 'monospace');
            text.textContent = node.label;
            svg.appendChild(text);
        });
    }, [nodes, links]);

    if (nodes.length === 0) return null;

    return (
        <div className="card">
            <p className="label-section mb-4">Import Flow — Every Row Accounted For</p>
            <svg ref={svgRef} width="100%" style={{ minHeight: 400 }} />
        </div>
    );
}
