"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTokens, formatCount } from "@/lib/format";
import type { ToolBreakdownRow } from "@/lib/efficiency-queries";
import { cn } from "@/lib/utils";

interface ToolBreakdownProps {
  data: ToolBreakdownRow[];
  height?: number;
}

type Mode = "count" | "tokens";

interface TooltipPayloadItem {
  payload?: ToolBreakdownRow;
  value?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  mode: Mode;
}

function ChartTooltip({ active, payload, mode }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-md border border-accent bg-surface px-3 py-2 font-mono text-[11px] text-fg">
      <div className="text-fg">{p.tool}</div>
      <div className="font-tabular text-fg-muted">
        {mode === "count" ? `${formatCount(p.count)} calls` : `${formatTokens(p.estTokens)} tokens (est)`}
      </div>
    </div>
  );
}

export function ToolBreakdown({ data, height = 320 }: ToolBreakdownProps) {
  const [mode, setMode] = useState<Mode>("count");
  const dataKey: keyof ToolBreakdownRow = mode === "count" ? "count" : "estTokens";
  const sorted = [...data].sort((a, b) => Number(b[dataKey]) - Number(a[dataKey]));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border">
        {(["count", "tokens"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "-mb-px border-b-2 px-2 py-1.5 text-[12px] transition-colors",
              mode === m
                ? "border-accent text-fg"
                : "border-transparent text-fg-muted hover:text-fg"
            )}
          >
            {m === "count" ? "By count" : "By tokens"}
          </button>
        ))}
      </div>
      <div className="flex-1 pt-3" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            margin={{ top: 4, right: 8, bottom: 8, left: 0 }}
            barCategoryGap="14%"
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="tool"
              type="category"
              interval={0}
              angle={-35}
              textAnchor="end"
              height={70}
              stroke="var(--border-strong)"
              tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              type="number"
              orientation="right"
              tickFormatter={(v: number) => (mode === "count" ? formatCount(v) : formatTokens(v))}
              stroke="var(--border-strong)"
              tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip mode={mode} />} />
            <Bar
              dataKey={dataKey}
              fill="var(--accent)"
              isAnimationActive={false}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
