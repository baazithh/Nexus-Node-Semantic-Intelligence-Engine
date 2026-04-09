"use client";

import type { GraphNode, GraphEdge } from "@/app/page";
import { Database, Wifi, WifiOff, Loader } from "lucide-react";

type Props = {
  wsStatus: "connecting" | "live" | "error";
  nodes: GraphNode[];
  edges: GraphEdge[];
  sensitivity: number;
};

export default function StatusBar({ wsStatus, nodes, edges, sensitivity }: Props) {
  const posEdges = edges.filter((e) => e.sentiment > 0.15).length;
  const negEdges = edges.filter((e) => e.sentiment < -0.15).length;
  const avgSentiment = edges.length
    ? edges.reduce((s, e) => s + e.sentiment, 0) / edges.length
    : 0;

  const WsIcon = wsStatus === "live" ? Wifi : wsStatus === "connecting" ? Loader : WifiOff;
  const wsColor = wsStatus === "live" ? "#00ff88" : wsStatus === "connecting" ? "#ffaa00" : "#ff2244";

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 border-t border-nexus-border bg-nexus-surface shrink-0 text-[0.58rem] font-mono text-nexus-text-dim">
      {/* WS status */}
      <div className="flex items-center gap-1.5">
        <WsIcon size={9} style={{ color: wsColor }} className={wsStatus === "connecting" ? "animate-spin" : ""} />
        <span style={{ color: wsColor }}>{wsStatus.toUpperCase()}</span>
      </div>

      <div className="h-3 w-px bg-nexus-border" />

      {/* Nodes / Edges */}
      <div className="flex items-center gap-1">
        <Database size={9} className="text-nexus-cyan" />
        <span className="text-nexus-text">{nodes.length}</span>
        <span>NODES</span>
        <span className="mx-1 opacity-40">/</span>
        <span className="text-nexus-text">{edges.length}</span>
        <span>EDGES</span>
      </div>

      <div className="h-3 w-px bg-nexus-border" />

      {/* Sentiment breakdown */}
      <div className="flex items-center gap-3">
        <span className="text-nexus-green">▲ {posEdges}</span>
        <span>NEUTRAL {edges.length - posEdges - negEdges}</span>
        <span className="text-nexus-crimson">▼ {negEdges}</span>
      </div>

      <div className="h-3 w-px bg-nexus-border" />

      {/* Avg sentiment */}
      <div className="flex items-center gap-1">
        <span>CORPUS SENT:</span>
        <span
          className="font-bold"
          style={{ color: avgSentiment > 0.05 ? "#00ff88" : avgSentiment < -0.05 ? "#ff2244" : "#5a7a9a" }}
        >
          {avgSentiment > 0 ? "+" : ""}{avgSentiment.toFixed(3)}
        </span>
      </div>

      <div className="h-3 w-px bg-nexus-border" />
      <div className="flex items-center gap-1">
        <span>SENSITIVITY:</span>
        <span className="text-nexus-cyan">{(sensitivity * 100).toFixed(0)}%</span>
      </div>

      <div className="ml-auto text-nexus-text-dim opacity-40 tracking-widest">
        NEXUS-NODE © 2026
      </div>
    </div>
  );
}
