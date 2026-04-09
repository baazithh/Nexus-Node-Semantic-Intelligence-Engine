"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import CommandConsole from "@/components/CommandConsole";
import LiveStream from "@/components/LiveStream";
import StatusBar from "@/components/StatusBar";
import NodeModal from "@/components/NodeModal";
import { Activity, Cpu, GitBranch } from "lucide-react";

// Dynamic import — force-graph requires browser canvas
const NexusMap = dynamic(() => import("@/components/NexusMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="text-nexus-cyan glow-cyan text-xs font-mono tracking-widest animate-pulse mb-3">
          INITIALIZING NEXUS-MAP...
        </div>
        <div className="w-32 h-1 bg-nexus-border mx-auto rounded overflow-hidden">
          <div className="h-full bg-nexus-cyan animate-[slide_1.5s_ease-in-out_infinite]" style={{ width: "60%" }} />
        </div>
      </div>
    </div>
  ),
});

export type GraphNode = {
  id: string;
  name: string;
  type: string;
  weight: number;
  event_count: number;
  avg_sentiment: number;
  x?: number;
  y?: number;
};

export type GraphEdge = {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  event_id: string;
  sentiment: number;
  timestamp: string;
  flagged: boolean;
  weight: number;
};

export type StreamEvent = {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  entities: { name: string; type: string }[];
  sentiment: number;
  raw_text: string;
};

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/stream";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function NexusTerminal() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [wsStatus, setWsStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [eventCount, setEventCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const mergeGraph = useCallback((newNodes: GraphNode[], newEdges: GraphEdge[]) => {
    setNodes((prev) => {
      const map = new Map(prev.map((n) => [n.id, n]));
      newNodes.forEach((n) => map.set(n.id, { ...map.get(n.id), ...n }));
      return Array.from(map.values());
    });
    setEdges((prev) => {
      const map = new Map(prev.map((e) => [e.id, e]));
      newEdges.forEach((e) => map.set(e.id, e));
      // Keep last 800 edges
      const all = Array.from(map.values());
      return all.slice(-800);
    });
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus("live");
    ws.onclose = () => {
      setWsStatus("error");
      reconnectTimer.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => setWsStatus("error");

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "snapshot") {
          const g = data.graph;
          setNodes(g.nodes || []);
          setEdges(g.edges || []);
        } else if (data.type === "event") {
          const ev: StreamEvent = data.event;
          setEvents((prev) => [ev, ...prev].slice(0, 200));
          setEventCount((c) => c + 1);
          if (data.new_edges?.length) {
            // Add new entity nodes from the event
            const newNodes: GraphNode[] = ev.entities.map((ent) => ({
              id: ent.name,
              name: ent.name,
              type: ent.type === "ORG" ? "Company" : "Person",
              weight: 1.0,
              event_count: 1,
              avg_sentiment: ev.sentiment,
            }));
            mergeGraph(newNodes, data.new_edges);
          }
        }
      } catch { /* ignore parse errors */ }
    };
  }, [mergeGraph]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const handleIntervention = useCallback(async (action: string, source: string, target?: string, eventId?: string, sentimentVal?: number) => {
    try {
      const res = await fetch(`${API_URL}/intervention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, source_entity: source, target_entity: target, event_id: eventId, sentiment: sentimentVal }),
      });
      const data = await res.json();
      return data.success as boolean;
    } catch { return false; }
  }, []);

  const handleSensitivity = useCallback(async (val: number) => {
    setSensitivity(val);
    try {
      await fetch(`${API_URL}/sensitivity`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: val }),
      });
    } catch { /* offline */ }
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-nexus-bg overflow-hidden scanlines">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4 px-4 py-2 border-b border-nexus-border bg-nexus-surface shrink-0 z-10">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-nexus-cyan" />
          <span className="text-nexus-cyan glow-cyan font-mono text-sm font-bold tracking-widest flicker">
            NEXUS-NODE
          </span>
          <span className="text-nexus-text-dim text-xs">v1.0.0</span>
        </div>

        <div className="h-4 w-px bg-nexus-border" />

        <div className="flex items-center gap-1.5">
          <span className={`status-dot ${wsStatus === "live" ? "active" : wsStatus === "connecting" ? "warning" : "error"}`} />
          <span className="text-xs font-mono text-nexus-text-dim">
            {wsStatus === "live" ? "STREAM LIVE" : wsStatus === "connecting" ? "CONNECTING..." : "DISCONNECTED"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          <Activity size={11} className="text-nexus-text-dim" />
          <span className="text-xs font-mono text-nexus-text-dim">
            {eventCount.toString().padStart(5, "0")} EVENTS
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Cpu size={11} className="text-nexus-text-dim" />
          <span className="text-xs font-mono text-nexus-text-dim">
            {nodes.length} NODES / {edges.length} EDGES
          </span>
        </div>

        <div className="ml-auto text-xs font-mono text-nexus-text-dim tracking-widest opacity-60">
          SEMANTIC INTELLIGENCE ENGINE
        </div>
      </header>

      {/* ── Main 3-panel layout ──────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* Left — Command Console */}
        <div className="w-64 shrink-0 border-r border-nexus-border bg-nexus-surface flex flex-col">
          <CommandConsole
            nodes={nodes}
            sensitivity={sensitivity}
            onSensitivityChange={handleSensitivity}
            onIntervention={handleIntervention}
          />
        </div>

        {/* Center — Nexus Map */}
        <div className="flex-1 min-w-0 relative bg-nexus-bg">
          <NexusMap
            nodes={nodes}
            edges={edges}
            onNodeClick={setSelectedNode}
          />
        </div>

        {/* Right — Live Stream */}
        <div className="w-72 shrink-0 border-l border-nexus-border bg-nexus-surface flex flex-col">
          <LiveStream events={events} />
        </div>
      </div>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      <StatusBar wsStatus={wsStatus} nodes={nodes} edges={edges} sensitivity={sensitivity} />

      {/* ── Node modal ──────────────────────────────────────────────── */}
      {selectedNode && (
        <NodeModal
          node={selectedNode}
          edges={edges}
          events={events}
          onClose={() => setSelectedNode(null)}
          onIntervention={handleIntervention}
        />
      )}
    </div>
  );
}
