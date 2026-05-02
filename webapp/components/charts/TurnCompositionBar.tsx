"use client";

import { useState } from "react";
import { formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TurnCompositionBarProps {
  input: number;
  cacheRead: number;
  cacheCreation: number;
  output: number;
  total: number;
  maxTotal: number;
}

interface Segment {
  key: "input" | "cacheRead" | "cacheCreation" | "output";
  label: string;
  value: number;
  color: string;
}

// A single horizontal bar (8px tall) split into 4 colored segments.
// The bar's overall width scales with total/maxTotal so users can compare
// turn composition at a glance.
export function TurnCompositionBar({
  input,
  cacheRead,
  cacheCreation,
  output,
  total,
  maxTotal,
}: TurnCompositionBarProps) {
  const [hover, setHover] = useState<Segment | null>(null);

  const widthPct = maxTotal > 0 ? Math.min(100, (total / maxTotal) * 100) : 0;
  const denom = Math.max(1, total);

  const segments: Segment[] = [
    { key: "input", label: "input", value: input, color: "var(--text-muted)" },
    { key: "cacheRead", label: "cache_read", value: cacheRead, color: "var(--positive)" },
    { key: "cacheCreation", label: "cache_creation", value: cacheCreation, color: "var(--accent-soft)" },
    { key: "output", label: "output", value: output, color: "var(--accent)" },
  ];

  return (
    <div className="relative w-full">
      <div
        className="h-2 w-full bg-surface-2"
        aria-hidden
        style={{ borderRadius: 1 }}
      >
        <div
          className="flex h-full overflow-hidden"
          style={{ width: `${widthPct}%`, borderRadius: 1 }}
        >
          {segments.map((s) => {
            const w = denom === 0 ? 0 : (s.value / denom) * 100;
            if (w === 0) return null;
            return (
              <div
                key={s.key}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  "h-full",
                  hover && hover.key !== s.key && "opacity-60"
                )}
                style={{ width: `${w}%`, backgroundColor: s.color }}
              />
            );
          })}
        </div>
      </div>
      {hover ? (
        <div className="pointer-events-none absolute -top-7 left-0 rounded-md border border-accent bg-surface px-2 py-1 font-mono text-[10px] text-fg shadow-sm">
          <span className="text-fg-muted">{hover.label}</span>{" "}
          <span className="font-tabular">{formatTokens(hover.value)}</span>
        </div>
      ) : null}
    </div>
  );
}
