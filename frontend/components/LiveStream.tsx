"use client";

import { useEffect, useRef, useState } from "react";
import type { StreamEvent } from "@/app/page";
import { Radio } from "lucide-react";

type Props = { events: StreamEvent[] };

function sentimentClass(s: number): string {
  if (s > 0.15) return "positive";
  if (s < -0.15) return "negative";
  return "neutral";
}

function sentimentBadge(s: number) {
  if (s > 0.15) return <span className="tag tag-pos">{s > 0 ? "+" : ""}{s.toFixed(2)}</span>;
  if (s < -0.15) return <span className="tag tag-neg">{s.toFixed(2)}</span>;
  return <span className="tag tag-neu">{s.toFixed(2)}</span>;
}
export default function LiveStream({ events }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isPausedRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="nexus-header shrink-0">
        <Radio size={10} className="animate-pulse" />
        <span>LIVE STREAM</span>
        <span className="ml-auto text-nexus-text-dim">
          {events.length} PACKETS
        </span>
      </div>

      {/* Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onMouseEnter={() => { isPausedRef.current = true; }}
        onMouseLeave={() => { isPausedRef.current = false; }}
      >
        {events.length === 0 ? (
          <div className="p-4 text-center text-nexus-text-dim text-[0.62rem] animate-pulse">
            Waiting for stream...
          </div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className={`stream-entry ${sentimentClass(ev.sentiment)}`}
            >
              {/* Timestamp + source */}
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-nexus-text-dim text-[0.55rem]">
                  {mounted ? new Date(ev.timestamp).toLocaleTimeString("en-US", { hour12: false }) : "--:--:--"}
                </span>
                <span className="text-nexus-cyan-dim text-[0.55rem] uppercase tracking-wider">
                  {ev.source}
                </span>
                {sentimentBadge(ev.sentiment)}
              </div>

              {/* Headline */}
              <p className="text-nexus-text text-[0.62rem] leading-snug mb-1.5">
                {ev.headline}
              </p>

              {/* Entities */}
              {ev.entities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ev.entities.map((ent, i) => (
                    <span
                      key={i}
                      className={`tag ${ent.type === "ORG" ? "tag-org" : "tag-person"}`}
                    >
                      {ent.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Event ID strip */}
              <div className="text-[0.5rem] text-nexus-text-dim mt-1.5 font-mono opacity-50 truncate">
                ID: {ev.id}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
