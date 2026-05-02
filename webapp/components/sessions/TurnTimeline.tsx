"use client";

import { useState } from "react";
import { TurnRow } from "./TurnRow";
import type { TurnRow as TurnData } from "@/lib/efficiency-queries";

interface TurnTimelineProps {
  turns: TurnData[];
}

export function TurnTimeline({ turns }: TurnTimelineProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const maxTotal = Math.max(1, ...turns.map((t) => t.totalTokens));

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="divide-y divide-border">
      {turns.map((t, i) => (
        <TurnRow
          key={t.id}
          turn={t}
          index={i}
          maxTotal={maxTotal}
          expanded={!!expanded[t.id]}
          onToggle={() => toggle(t.id)}
        />
      ))}
    </div>
  );
}
