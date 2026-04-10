"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { GraphNode, GraphEdge } from "@/app/page";

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (node: GraphNode) => void;
};

type TooltipState = {
  x: number;
  y: number;
  node: GraphNode;
} | null;

// Sentiment → color
function edgeColor(sentiment: number): string {
  if (sentiment > 0.15) return `rgba(0,255,136,${0.3 + Math.abs(sentiment) * 0.7})`;
  if (sentiment < -0.15) return `rgba(255,34,68,${0.3 + Math.abs(sentiment) * 0.7})`;
  return "rgba(90,122,154,0.4)";
}

function nodeColor(type: string, sentiment: number): string {
  if (sentiment > 0.4) return "#00ff88"; // High positive
  if (sentiment < -0.4) return "#ff2244"; // High negative
  return type === "Person" ? "#ffaa00" : "#00d4ff";
}

export default function NexusMap({ nodes, edges, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [is3D, setIs3D] = useState(false);
  const [ForceGraph, setForceGraph] = useState<any>(null);

  // Dynamic import on client
  useEffect(() => {
    import("react-force-graph-2d").then((mod) => {
      setForceGraph(() => mod.default);
    });
  }, []);

  const graphData = {
    nodes: nodes.map((n) => ({
      ...n,
      val: Math.max(1, n.event_count * 0.8),
      color: nodeColor(n.type, n.avg_sentiment),
    })),
    links: edges.map((e) => ({
      ...e,
      source: typeof e.source === "string" ? e.source : (e.source as GraphNode).id,
      target: typeof e.target === "string" ? e.target : (e.target as GraphNode).id,
      color: edgeColor(e.sentiment),
      width: Math.max(0.5, Math.abs(e.sentiment) * 3),
    })),
  };

  const handleNodeClick = useCallback(
    (node: any) => onNodeClick(node as GraphNode),
    [onNodeClick],
  );

  const handleNodeHover = useCallback((node: any, prevNode: any, event: MouseEvent) => {
    if (node) {
      setTooltip({ x: event.clientX + 12, y: event.clientY - 8, node: node as GraphNode });
    } else {
      setTooltip(null);
    }
  }, []);

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r = Math.max(4, Math.sqrt(node.val || 1) * 5);
    const x = node.x || 0;
    const y = node.y || 0;
    const color = node.color || "#00d4ff";

    // Outer glow
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
    grd.addColorStop(0, color + "55");
    grd.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(x, y, r * 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = grd;
    ctx.fill();

    // Core circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color + "22";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(x, y, r * 0.35, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Label
    if (globalScale > 0.6) {
      ctx.font = `${Math.max(8, 10 / globalScale)}px JetBrains Mono, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(node.name.length > 14 ? node.name.slice(0, 12) + "…" : node.name, x, y + r + 10 / globalScale);
    }
  }, []);

  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source;
    const end = link.target;
    if (!start?.x || !end?.x) return;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = link.color || "rgba(90,122,154,0.3)";
    ctx.lineWidth = (link.width || 1) / globalScale;

    if (link.flagged) {
      ctx.setLineDash([4 / globalScale, 4 / globalScale]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const bgColor = "#050a0e";

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <button
          onClick={() => graphRef.current?.zoomToFit(400)}
          className="nexus-btn nexus-btn-cyan text-[0.6rem]"
        >
          FIT VIEW
        </button>
        <button
          onClick={() => graphRef.current?.centerAt(0, 0, 400)}
          className="nexus-btn nexus-btn-cyan text-[0.6rem]"
        >
          CENTER
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 nexus-panel p-3 flex flex-col gap-2 text-[0.6rem]">
        <div className="text-nexus-text-dim tracking-widest uppercase mb-1">LEGEND</div>
        <div className="flex items-center gap-2">
          <span className="status-dot" style={{ background: "#00d4ff", boxShadow: "0 0 6px #00d4ff" }} />
          <span>Organization</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-dot" style={{ background: "#ffaa00", boxShadow: "0 0 6px #ffaa00" }} />
          <span>Person</span>
        </div>
        <div className="w-full h-px bg-nexus-border my-1" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5" style={{ background: "#00ff88" }} />
          <span className="text-nexus-green">Positive</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5" style={{ background: "#ff2244" }} />
          <span className="text-nexus-crimson">Negative</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5" style={{ background: "#5a7a9a" }} />
          <span className="text-nexus-text-dim">Neutral</span>
        </div>
      </div>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-5">
          <div className="text-center">
            <div className="text-nexus-cyan glow-cyan text-xs font-mono tracking-widest animate-pulse">
              AWAITING DATA STREAM...
            </div>
            <div className="text-nexus-text-dim text-[0.6rem] mt-2">Connecting to backend pipeline</div>
          </div>
        </div>
      )}

      {/* Graph */}
      {ForceGraph && containerRef.current && (
        <ForceGraph
          ref={graphRef}
          graphData={graphData}
          width={containerRef.current.clientWidth}
          height={containerRef.current.clientHeight}
          backgroundColor={bgColor}
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => "replace"}
          linkCanvasObject={paintLink}
          linkCanvasObjectMode={() => "replace"}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          nodeLabel={null}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={(link: any) => link.color}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          cooldownTicks={150}
          onEngineStop={() => {}}
          enableNodeDrag={true}
          enablePanInteraction={true}
          enableZoomInteraction={true}
        />
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="node-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-nexus-cyan font-bold text-xs mb-2 tracking-wide">
            {tooltip.node.name}
          </div>
          <div className="flex flex-col gap-1 text-[0.62rem] text-nexus-text-dim">
            <div className="flex justify-between gap-4">
              <span>TYPE</span>
              <span className={tooltip.node.type === "Person" ? "text-nexus-amber" : "text-nexus-cyan"}>
                {tooltip.node.type?.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>EVENTS</span>
              <span className="text-nexus-text">{tooltip.node.event_count}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>AVG SENTIMENT</span>
              <span className={tooltip.node.avg_sentiment > 0 ? "text-nexus-green" : tooltip.node.avg_sentiment < 0 ? "text-nexus-crimson" : "text-nexus-text-dim"}>
                {tooltip.node.avg_sentiment?.toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
