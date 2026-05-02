import { AlertTriangle, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/insights";

interface InsightCardProps {
  insight: Insight;
  isFirst?: boolean;
}

export function InsightCard({ insight, isFirst = false }: InsightCardProps) {
  const Icon =
    insight.icon === "warning"
      ? AlertTriangle
      : insight.icon === "positive"
        ? CheckCircle
        : Info;

  const tint =
    insight.icon === "warning"
      ? "text-accent"
      : insight.icon === "positive"
        ? "text-positive"
        : "text-fg-muted";

  const deltaTint =
    insight.icon === "positive" ? "text-positive" : "text-accent";

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-3",
        !isFirst && "border-t border-border"
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tint)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-fg">{insight.title}</div>
        <div className="mt-0.5 text-[13px] text-fg-muted">{insight.detail}</div>
      </div>
      {insight.deltaText ? (
        <span
          className={cn(
            "shrink-0 rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] font-tabular",
            deltaTint
          )}
        >
          {insight.deltaText}
        </span>
      ) : null}
    </div>
  );
}
