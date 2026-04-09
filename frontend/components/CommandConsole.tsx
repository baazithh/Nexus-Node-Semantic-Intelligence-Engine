"use client";

import { useState } from "react";
import type { GraphNode } from "@/app/page";
import {
  Sliders, Scissors, Plus, Flag, AlertCircle,
  ChevronRight, Zap, Shield,
} from "lucide-react";

type Props = {
  nodes: GraphNode[];
  sensitivity: number;
  onSensitivityChange: (val: number) => void;
  onIntervention: (
    action: string,
    source: string,
    target?: string,
    eventId?: string,
    sentiment?: number,
  ) => Promise<boolean>;
};

export default function CommandConsole({ nodes, sensitivity, onSensitivityChange, onIntervention }: Props) {
  const [pruneSource, setPruneSource] = useState("");
  const [pruneTarget, setPruneTarget] = useState("");
  const [createSource, setCreateSource] = useState("");
  const [createTarget, setCreateTarget] = useState("");
  const [createSentiment, setCreateSentiment] = useState(0);
  const [flagSource, setFlagSource] = useState("");
  const [flagEventId, setFlagEventId] = useState("");
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>("sensitivity");

  const nodeNames = nodes.map((n) => n.name);

  const flash = (msg: string, ok: boolean) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handlePrune = async () => {
    if (!pruneSource || !pruneTarget) return flash("Specify source & target", false);
    const ok = await onIntervention("prune", pruneSource, pruneTarget);
    ok ? flash(`Edge pruned: ${pruneSource} → ${pruneTarget}`, true) : flash("Prune failed", false);
    if (ok) { setPruneSource(""); setPruneTarget(""); }
  };

  const handleCreate = async () => {
    if (!createSource || !createTarget) return flash("Specify both entities", false);
    const ok = await onIntervention("create", createSource, createTarget, undefined, createSentiment);
    ok ? flash(`Edge created: ${createSource} ↔ ${createTarget}`, true) : flash("Create failed", false);
    if (ok) { setCreateSource(""); setCreateTarget(""); }
  };

  const handleFlag = async () => {
    if (!flagSource || !flagEventId) return flash("Specify entity & event ID", false);
    const ok = await onIntervention("flag", flagSource, undefined, flagEventId);
    ok ? flash(`Event flagged, weight reduced`, true) : flash("Flag failed", false);
    if (ok) { setFlagSource(""); setFlagEventId(""); }
  };

  const toggle = (s: string) => setActiveSection((prev) => (prev === s ? null : s));

  const Section = ({ id, icon: Icon, label, color, children }: any) => (
    <div className="border-b border-nexus-border">
      <button
        onClick={() => toggle(id)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
      >
        <Icon size={11} style={{ color }} />
        <span className="text-[0.62rem] font-bold tracking-widest uppercase flex-1" style={{ color }}>
          {label}
        </span>
        <ChevronRight
          size={10}
          className="text-nexus-text-dim transition-transform duration-200"
          style={{ transform: activeSection === id ? "rotate(90deg)" : "rotate(0deg)" }}
        />
      </button>
      {activeSection === id && (
        <div className="px-3 pb-3 flex flex-col gap-2">{children}</div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="nexus-header shrink-0">
        <Shield size={10} />
        <span>COMMAND CONSOLE</span>
        <span className="ml-auto text-nexus-text-dim">{nodes.length} NODES</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Sensitivity */}
        <Section id="sensitivity" icon={Sliders} label="Sensitivity" color="#00d4ff">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[0.6rem] text-nexus-text-dim">SIGNAL THRESHOLD</span>
            <span className="text-[0.68rem] text-nexus-cyan font-bold">
              {(sensitivity * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1.0}
            step={0.05}
            value={sensitivity}
            onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
            className="nexus-slider"
          />
          <div className="flex justify-between text-[0.55rem] text-nexus-text-dim mt-0.5">
            <span>LOW</span>
            <span>HIGH</span>
          </div>
          <p className="text-[0.58rem] text-nexus-text-dim mt-2 leading-relaxed">
            Controls event ingestion rate. Higher sensitivity filters low-signal events from the stream.
          </p>
        </Section>

        {/* Prune Edge */}
        <Section id="prune" icon={Scissors} label="Prune Edge" color="#ff2244">
          <p className="text-[0.58rem] text-nexus-text-dim mb-2">
            Remove a relationship between two entities.
          </p>
          <label className="text-[0.58rem] text-nexus-text-dim uppercase tracking-wider mb-0.5">
            Source Entity
          </label>
          <input
            list="node-names"
            value={pruneSource}
            onChange={(e) => setPruneSource(e.target.value)}
            placeholder="e.g. Tesla"
            className="nexus-input mb-2"
          />
          <label className="text-[0.58rem] text-nexus-text-dim uppercase tracking-wider mb-0.5">
            Target Entity / Event ID
          </label>
          <input
            list="node-names"
            value={pruneTarget}
            onChange={(e) => setPruneTarget(e.target.value)}
            placeholder="e.g. NVIDIA or event-id"
            className="nexus-input mb-2"
          />
          <button onClick={handlePrune} className="nexus-btn nexus-btn-red w-full">
            ⚡ PRUNE EDGE
          </button>
        </Section>

        {/* Create Edge */}
        <Section id="create" icon={Plus} label="Create Edge" color="#00ff88">
          <p className="text-[0.58rem] text-nexus-text-dim mb-2">
            Manually link two entities.
          </p>
          <label className="text-[0.58rem] text-nexus-text-dim uppercase tracking-wider mb-0.5">
            Entity A
          </label>
          <input
            list="node-names"
            value={createSource}
            onChange={(e) => setCreateSource(e.target.value)}
            placeholder="e.g. Apple"
            className="nexus-input mb-2"
          />
          <label className="text-[0.58rem] text-nexus-text-dim uppercase tracking-wider mb-0.5">
            Entity B
          </label>
          <input
            list="node-names"
            value={createTarget}
            onChange={(e) => setCreateTarget(e.target.value)}
            placeholder="e.g. Microsoft"
            className="nexus-input mb-2"
          />
          <label className="text-[0.58rem] text-nexus-text-dim uppercase tracking-wider mb-0.5">
            Sentiment: {createSentiment.toFixed(2)}
          </label>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={createSentiment}
            onChange={(e) => setCreateSentiment(parseFloat(e.target.value))}
            className="nexus-slider mb-2"
          />
          <div className="flex justify-between text-[0.55rem] mb-2">
            <span className="text-nexus-crimson">NEGATIVE</span>
            <span className="text-nexus-green">POSITIVE</span>
          </div>
          <button onClick={handleCreate} className="nexus-btn nexus-btn-green w-full">
            ＋ CREATE EDGE
          </button>
        </Section>

        {/* Flag Event */}
        <Section id="flag" icon={Flag} label="Flag Event" color="#ffaa00">
          <p className="text-[0.58rem] text-nexus-text-dim mb-2">
            Flag an event as unreliable — triggers write-back to halve edge weight.
          </p>
          <label className="text-[0.58rem] text-nexus-text-dim uppercase tracking-wider mb-0.5">
            Entity Name
          </label>
          <input
            list="node-names"
            value={flagSource}
            onChange={(e) => setFlagSource(e.target.value)}
            placeholder="e.g. Elon Musk"
            className="nexus-input mb-2"
          />
          <label className="text-[0.58rem] text-nexus-text-dim uppercase tracking-wider mb-0.5">
            Event ID
          </label>
          <input
            value={flagEventId}
            onChange={(e) => setFlagEventId(e.target.value)}
            placeholder="Paste event UUID"
            className="nexus-input mb-2"
          />
          <button onClick={handleFlag} className="nexus-btn nexus-btn-amber w-full">
            ⚑ FLAG EVENT
          </button>
        </Section>

        {/* System info */}
        <div className="p-3 flex flex-col gap-2">
          <div className="text-[0.58rem] text-nexus-text-dim uppercase tracking-wider mb-1 flex items-center gap-1">
            <Zap size={9} className="text-nexus-cyan" />
            <span>SYSTEM</span>
          </div>
          {[
            { label: "PIPELINE", val: "ACTIVE", color: "#00ff88" },
            { label: "NER", val: "EN_CORE", color: "#00d4ff" },
            { label: "SENTIMENT", val: "TEXTBLOB", color: "#00d4ff" },
            { label: "GRAPH DB", val: "NEO4J / MEM", color: "#ffaa00" },
            { label: "LOG DB", val: "PG / MEM", color: "#ffaa00" },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex justify-between text-[0.6rem]">
              <span className="text-nexus-text-dim">{label}</span>
              <span style={{ color }} className="font-bold">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`mx-3 mb-3 px-3 py-2 rounded text-[0.62rem] font-mono border flex items-center gap-2 ${
          feedback.ok
            ? "bg-nexus-green/10 border-nexus-green text-nexus-green"
            : "bg-nexus-crimson/10 border-nexus-crimson text-nexus-crimson"
        }`}>
          <AlertCircle size={10} />
          {feedback.msg}
        </div>
      )}

      {/* Node autocomplete datalist */}
      <datalist id="node-names">
        {nodeNames.map((n) => <option key={n} value={n} />)}
      </datalist>
    </div>
  );
}
