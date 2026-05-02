"use client";

import { useUrlState } from "./url-sync";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { key: "hour", label: "HOUR" },
  { key: "day", label: "DAY" },
  { key: "week", label: "WEEK" },
  { key: "month", label: "MONTH" },
] as const;

export function GroupByToggle() {
  const { params, setParams } = useUrlState();
  const current = params.get("groupBy") ?? "day";

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border">
      {OPTIONS.map((o, i) => (
        <button
          key={o.key}
          type="button"
          onClick={() => setParams({ groupBy: o.key })}
          className={cn(
            "px-2.5 py-1 font-mono text-[11px] transition-colors",
            i > 0 && "border-l border-border",
            current === o.key
              ? "bg-accent text-bg"
              : "bg-surface text-fg-muted hover:bg-surface-2"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
