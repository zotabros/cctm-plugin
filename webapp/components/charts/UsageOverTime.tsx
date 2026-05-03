"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTokens } from "@/lib/format";
import type { UsageBucket, UsageSeries, GroupBy } from "@/lib/queries";

interface UsageOverTimeProps {
  buckets: UsageBucket[];
  series: UsageSeries[];
  groupBy: GroupBy;
  height?: number;
}

function tickFormatter(groupBy: GroupBy) {
  return (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    if (groupBy === "hour") {
      return `${d.getUTCHours().toString().padStart(2, "0")}:00`;
    }
    if (groupBy === "month") {
      return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
    }
    return d.toLocaleString("en-US", { month: "short", day: "numeric" });
  };
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  series: UsageSeries[];
}

function ChartTooltip({ active, payload, label, series }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((acc, p) => acc + (Number(p.value) || 0), 0);
  return (
    <div className="rounded-md border border-accent bg-surface px-3 py-2 font-mono text-[11px] text-fg shadow-none">
      <div className="mb-1 text-fg-muted">
        {label ? new Date(label).toLocaleString() : ""}
      </div>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        return (
          <div key={String(p.dataKey)} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: s?.color ?? p.color ?? "var(--accent)" }}
            />
            <span className="flex-1 text-fg-muted">{s?.label ?? String(p.name)}</span>
            <span className="font-tabular">{formatTokens(Number(p.value) || 0)}</span>
          </div>
        );
      })}
      <div className="mt-1 flex items-center justify-between border-t border-border pt-1">
        <span className="text-fg-muted">Total</span>
        <span className="font-tabular">{formatTokens(total)}</span>
      </div>
    </div>
  );
}

export function UsageOverTime({
  buckets,
  series,
  groupBy,
  height = 360,
}: UsageOverTimeProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 12, right: 8, bottom: 8, left: 0 }} barCategoryGap="14%">
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="ts"
            tickFormatter={tickFormatter(groupBy)}
            stroke="var(--border-strong)"
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            orientation="right"
            tickFormatter={(v: number) => formatTokens(v)}
            stroke="var(--border-strong)"
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={<ChartTooltip series={series} />}
          />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="usage"
              fill={s.color}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
