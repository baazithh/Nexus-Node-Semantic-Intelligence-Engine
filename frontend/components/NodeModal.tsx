"use client";

import type { GraphNode, GraphEdge, StreamEvent } from "@/app/page";
import { X, ChevronRight, Flag, Scissors } from "lucide-react";

type Props = {
  node: GraphNode;
  edges: GraphEdge[];
  events: StreamEvent[];
  onClose: () => void;
  onIntervention: (action: string, source: string, target?: string, eventId?: string, sentiment?: number) => Promise<boolean>;
};

export default function NodeModal({ node, edges, events, onClose, onIntervention }: Props) {
  const nodeEdges = edges.filter((e) => {
    const src = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
    const tgt = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
    return src === node.id || tgt === node.id;
  });

  const nodeEvents = events.filter((ev) =>
    ev.entities.some((ent) => ent.name === node.name),
  ).slice(0, 10);

  const handleFlag = async (eventId: string) => {
    await onIntervention("flag", node.name, undefined, eventId);
  };

  const handlePrune = async (edgeTarget: string) => {
    await onIntervention("prune", node.id, edgeTarget);
  };

  const posCount = nodeEdges.filter((e) => e.sentiment > 0.15).length;
  const negCount = nodeEdges.filter((e) => e.sentiment < -0.15).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(5,10,14,0.85)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="nexus-panel corner-bracket w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: "0 0 0 1px rgba(0,212,255,0.2), 0 24px 64px rgba(0,0,0,0.8)" }}
      >
        {/* Header */}
        <div className="nexus-header justify-between">
          <div className="flex items-center gap-2">
            <span
              className="status-dot"
              style={{
                background: node.type === "Person" ? "#ffaa00" : "#00d4ff",
                boxShadow: `0 0 8px ${node.type === "Person" ? "#ffaa00" : "#00d4ff"}`,
              }}
            />
            <span className="text-nexus-cyan text-sm font-bold tracking-wide">{node.name}</span>
            <span className="tag">{node.type === "Person" ? "PERSON" : "ORG"}</span>
          </div>
          <button onClick={onClose} className="text-nexus-text-dim hover:text-nexus-cyan transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "EVENTS", val: node.event_count, color: "#00d4ff" },
              { label: "AVG SENT", val: node.avg_sentiment?.toFixed(3), color: node.avg_sentiment > 0 ? "#00ff88" : node.avg_sentiment < 0 ? "#ff2244" : "#5a7a9a" },
              { label: "EDGES", val: nodeEdges.length, color: "#ffaa00" },
            ].map(({ label, val, color }) => (
              <div key={label} className="nexus-panel p-3 text-center">
                <div className="text-[0.55rem] text-nexus-text-dim tracking-wider mb-1">{label}</div>
                <div className="font-bold text-lg font-mono" style={{ color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Sentiment breakdown */}
          <div className="nexus-panel p-3">
            <div className="text-[0.6rem] text-nexus-text-dim uppercase tracking-wider mb-2">Sentiment Breakdown</div>
            <div className="flex gap-2 mb-2">
              <div className="flex-1 bg-nexus-border rounded overflow-hidden h-2">
                <div
                  className="h-full bg-nexus-green transition-all"
                  style={{ width: nodeEdges.length ? `${(posCount / nodeEdges.length) * 100}%` : "0%" }}
                />
              </div>
            </div>
            <div className="flex justify-between text-[0.58rem]">
              <span className="text-nexus-green">▲ {posCount} POSITIVE</span>
              <span className="text-nexus-text-dim">{nodeEdges.length - posCount - negCount} NEUTRAL</span>
              <span className="text-nexus-crimson">▼ {negCount} NEGATIVE</span>
            </div>
          </div>

          {/* Connected edges */}
          {nodeEdges.length > 0 && (
            <div>
              <div className="text-[0.6rem] text-nexus-text-dim uppercase tracking-wider mb-2">
                CONNECTIONS ({nodeEdges.length})
              </div>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {nodeEdges.slice(0, 20).map((e) => {
                  const src = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
                  const tgt = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
                  const other = src === node.id ? tgt : src;
                  return (
                    <div
                      key={e.id}
                      className="nexus-panel p-2 flex items-center justify-between text-[0.62rem]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronRight size={9} className="text-nexus-text-dim shrink-0" />
                        <span className="text-nexus-text truncate">{other}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="font-bold"
                          style={{ color: e.sentiment > 0.15 ? "#00ff88" : e.sentiment < -0.15 ? "#ff2244" : "#5a7a9a" }}
                        >
                          {e.sentiment > 0 ? "+" : ""}{e.sentiment.toFixed(2)}
                        </span>
                        <button
                          onClick={() => handlePrune(other)}
                          className="text-nexus-crimson hover:text-nexus-crimson/70 transition-colors"
                          title="Prune edge"
                        >
                          <Scissors size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent events */}
          {nodeEvents.length > 0 && (
            <div>
              <div className="text-[0.6rem] text-nexus-text-dim uppercase tracking-wider mb-2">
                RECENT EVENTS
              </div>
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {nodeEvents.map((ev) => (
                  <div key={ev.id} className="nexus-panel p-2.5 flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-nexus-text text-[0.62rem] leading-snug flex-1">{ev.headline}</p>
                      <button
                        onClick={() => handleFlag(ev.id)}
                        className="text-nexus-amber hover:text-nexus-amber/70 transition-colors shrink-0 mt-0.5"
                        title="Flag event"
                      >
                        <Flag size={10} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-nexus-text-dim text-[0.55rem]">
                        {new Date(ev.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                      </span>
                      <span
                        className="text-[0.6rem] font-bold"
                        style={{ color: ev.sentiment > 0.15 ? "#00ff88" : ev.sentiment < -0.15 ? "#ff2244" : "#5a7a9a" }}
                      >
                        {ev.sentiment > 0 ? "+" : ""}{ev.sentiment.toFixed(3)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
