import type { Insight } from "@/lib/insights";
import { InsightCard } from "./InsightCard";

interface InsightsListProps {
  items: Insight[];
}

export function InsightsList({ items }: InsightsListProps) {
  if (items.length === 0) {
    return (
      <div className="px-3 py-6 font-mono text-[12px] text-fg-subtle">
        No anomalies detected — running smooth.
      </div>
    );
  }
  return (
    <div className="-mx-2">
      {items.map((it, i) => (
        <InsightCard key={`${it.title}-${i}`} insight={it} isFirst={i === 0} />
      ))}
    </div>
  );
}
