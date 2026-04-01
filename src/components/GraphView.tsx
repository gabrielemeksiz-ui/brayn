'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GraphData, GraphNode } from '@/lib/types';

// Dynamic import to avoid SSR issues
import dynamic from 'next/dynamic';
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface GraphViewProps {
  getCatColor: (cat: string) => string;
  getCatLabel: (cat: string) => string;
  onSelectNote: (noteId: string) => void;
}

export function GraphView({ getCatColor, getCatLabel, onSelectNote }: GraphViewProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [threshold, setThreshold] = useState(0.4);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/graph?threshold=${threshold}`);
      const data: GraphData = await res.json();
      setGraphData(data);
    } catch (err) {
      console.error('Failed to fetch graph data:', err);
    }
    setLoading(false);
  }, [threshold]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[#e4e2e4]/30">Chargement du graphe...</p>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-3">
        <span className="material-symbols-outlined text-[48px] text-[#e4e2e4]/15">hub</span>
        <p className="text-sm text-[#e4e2e4]/30">Aucune note avec embedding</p>
        <p className="text-xs text-[#e4e2e4]/20">Les embeddings sont générés automatiquement à l&apos;ingestion</p>
      </div>
    );
  }

  const nodeTitle = (node: GraphNode) =>
    (node.clean_original_language ?? node.original_text ?? '').slice(0, 60);

  const primaryColor = (node: GraphNode) => {
    const firstCat = (node.categories ?? [])[0];
    return firstCat ? getCatColor(firstCat) : '#6B7280';
  };

  const forceGraphData = {
    nodes: graphData.nodes.map(n => ({ ...n, name: nodeTitle(n) })),
    links: graphData.edges.map(e => ({
      source: e.source,
      target: e.target,
      value: e.similarity,
    })),
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
      {/* Controls */}
      <div className="px-6 py-3 flex items-center gap-4 shrink-0 border-b border-[#2a2a2c]">
        <span className="text-xs text-[#e4e2e4]/40">
          {graphData.nodes.length} notes &middot; {graphData.edges.length} liens
        </span>
        <label className="flex items-center gap-2 text-xs text-[#e4e2e4]/40">
          Seuil:
          <input
            type="range"
            min="0.2"
            max="0.8"
            step="0.05"
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            className="w-24 accent-[#ffcbd0]"
          />
          <span className="text-[#ffcbd0] font-mono w-8">{threshold.toFixed(2)}</span>
        </label>
      </div>

      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute z-50 bg-[#1f1f21] border border-[#534344]/30 rounded-xl p-3 max-w-xs shadow-lg pointer-events-none"
          style={{ top: 80, right: 20 }}>
          <p className="text-sm text-[#e4e2e4] font-medium mb-1">{nodeTitle(hoveredNode)}</p>
          <div className="flex gap-1 flex-wrap">
            {(hoveredNode.categories ?? []).map(cat => (
              <span key={cat} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ backgroundColor: getCatColor(cat) + '20', color: getCatColor(cat) }}>
                {getCatLabel(cat)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Graph */}
      <div className="flex-1">
        <ForceGraph2D
          graphData={forceGraphData}
          width={containerRef.current?.clientWidth ?? 800}
          height={(containerRef.current?.clientHeight ?? 600) - 50}
          backgroundColor="#131315"
          nodeColor={(node: Record<string, unknown>) => primaryColor(node as unknown as GraphNode)}
          nodeRelSize={6}
          nodeLabel={(node: Record<string, unknown>) => (node as unknown as GraphNode & { name: string }).name}
          linkColor={() => 'rgba(255,203,208,0.15)'}
          linkWidth={(link: Record<string, unknown>) => ((link as { value: number }).value ?? 0.3) * 3}
          onNodeClick={(node: Record<string, unknown>) => onSelectNote((node as { id: string }).id)}
          onNodeHover={(node: Record<string, unknown> | null) => setHoveredNode(node as unknown as GraphNode | null)}
          cooldownTicks={100}
          nodeCanvasObject={(node: Record<string, unknown>, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const typedNode = node as unknown as GraphNode & { x: number; y: number; name: string };
            const label = typedNode.name;
            const fontSize = 11 / globalScale;
            const nodeR = 5;
            const color = primaryColor(typedNode);

            // Node circle
            ctx.beginPath();
            ctx.arc(typedNode.x, typedNode.y, nodeR, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            // Label (only if zoomed in enough)
            if (globalScale > 0.8) {
              ctx.font = `${fontSize}px Inter, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = '#e4e2e4';
              ctx.fillText(label.slice(0, 30), typedNode.x, typedNode.y + nodeR + 2);
            }
          }}
        />
      </div>
    </div>
  );
}
