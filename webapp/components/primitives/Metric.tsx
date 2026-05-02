import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { HairlineCard } from "./HairlineCard";
import { Sparkline } from "./Sparkline";

interface MetricProps {
  eyebrow: string;
  value: string;
  diff?: ReactNode;
  spark?: number[];
  sparkColor?: string;
  className?: string;
}

export function Metric({
  eyebrow,
  value,
  diff,
  spark,
  sparkColor,
  className,
}: MetricProps) {
  return (
    <HairlineCard className={cn("flex flex-col gap-3", className)}>
      <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
        {eyebrow}
      </div>
      <div className="font-serif text-[72px] font-light leading-none font-tabular text-fg">
        {value}
      </div>
      {diff ? <div>{diff}</div> : null}
      {spark && spark.length ? (
        <Sparkline data={spark} color={sparkColor} height={48} />
      ) : null}
    </HairlineCard>
  );
}
