"use client";

import { useEffect, useState, useRef } from "react";

const BOOT_LOGS = [
  "INITIALIZING NEXUS-NODE KERNEL...",
  "LOADING CORE MODULES...",
  "ESTABLISHING SECURE COMMUNICATION CHANNEL...",
  "MOUNTING SEMANTIC ENGINE v1.0.0...",
  "CONNECTING TO NEO4J GRAPH CLUSTER [BOLT://7687]...",
  "SYNCHRONIZING POSTGRES EVENT LOGS...",
  "CALIBRATING SENTIMENT VECTORS...",
  "HYPER-DATA MAPPING INITIALIZED.",
  "SEARCHING FOR ANOMALIES...",
  "SYSTEM STATUS: NOMINAL.",
  "ENTERING OPERATIONAL VIEWPORT..."
];

interface BootSequenceProps {
  onComplete: () => void;
}

export default function BootSequence({ onComplete }: BootSequenceProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (currentLogIndex < BOOT_LOGS.length) {
        setLogs((prev) => [...prev, BOOT_LOGS[currentLogIndex]]);
        setProgress(((currentLogIndex + 1) / BOOT_LOGS.length) * 100);
        currentLogIndex++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 1000);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="fixed inset-0 z-[100] bg-nexus-bg flex items-center justify-center font-mono selection:bg-nexus-cyan selection:text-nexus-bg">
      <div className="w-full max-w-2xl px-6">
        <div className="mb-8">
          <div className="text-nexus-cyan glow-cyan text-2xl font-bold tracking-[0.2em] mb-2 flicker">
            NEXUS-NODE
          </div>
          <div className="text-nexus-text-dim text-xs tracking-widest opacity-60">
            SEMANTIC INTELLIGENCE ENGINE // OPERATIONAL TERMINAL
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="h-64 border border-nexus-border bg-nexus-surface/50 p-4 overflow-y-auto mb-6 corner-bracket"
        >
          {logs.map((log, i) => (
            <div key={i} className="text-nexus-text text-xs mb-1.5 flex gap-3">
              <span className="text-nexus-text-dim opacity-40 select-none">
                [{mounted ? new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "00:00:00"}]
              </span>
              <span className={i === logs.length - 1 ? "text-nexus-cyan animate-pulse" : ""}>
                {log}
              </span>
            </div>
          ))}
          {logs.length < BOOT_LOGS.length && (
            <div className="text-nexus-cyan text-xs animate-pulse">_</div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-nexus-text-dim uppercase tracking-widest">
            <span>System Initialization</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 w-full bg-nexus-border rounded-full overflow-hidden">
            <div 
              className="h-full bg-nexus-cyan transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
