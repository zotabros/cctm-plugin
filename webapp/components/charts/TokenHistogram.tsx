"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTokens, formatCount } from "@/lib/format";
import type { HistogramResult } from "@/lib/efficiency-queries";

interface TokenHistogramProps {
  data: HistogramResult;
  height?: number;
}

function findBinIndex(
  bins: HistogramResult["bins"],
  value: number
): number {
  for (let i = 0; i < bins.length; i++) {
    const b = bins[i];
    if (value >= b.lower && value < b.upper) return i;
  }
  return -1;
}

interface TooltipPayloadItem {
  payload?: { label: string; count: number; lower: number; upper: number };
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-md border border-accent bg-surface px-3 py-2 font-mono text-[11px] text-fg">
      <div className="text-fg-muted">{p.label} tokens / turn</div>
      <div className="font-tabular">{formatCount(p.count)} turns</div>
    </div>
  );
}

export function TokenHistogram({ data, height = 320 }: TokenHistogramProps) {
  const p99Bin = findBinIndex(data.bins, data.p99);
  const maxCount = Math.max(1, ...data.bins.map((b) => b.count));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data.bins}
          margin={{ top: 24, right: 8, bottom: 8, left: 0 }}
          barCategoryGap="14%"
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--border-strong)"
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            orientation="right"
            tickFormatter={(v: number) => formatCount(v)}
            stroke="var(--border-strong)"
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
            tickLine={false}
            axisLine={false}
            width={48}
            domain={[0, Math.ceil(maxCount * 1.1)]}
          />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip />} />
          {/* Percentile reference lines */}
          {data.p50 > 0 ? (
            <ReferenceLine
              x={data.bins[findBinIndex(data.bins, data.p50)]?.label}
              stroke="var(--text-subtle)"
              strokeDasharray="3 3"
              label={{
                value: `P50 ${formatTokens(data.p50)}`,
                position: "top",
                fill: "var(--text-muted)",
                fontSize: 11,
                fontFamily: "var(--font-geist-mono)",
              }}
            />
          ) : null}
          {data.p90 > 0 ? (
            <ReferenceLine
              x={data.bins[findBinIndex(data.bins, data.p90)]?.label}
              stroke="var(--accent)"
              strokeDasharray="3 3"
              label={{
                value: `P90 ${formatTokens(data.p90)}`,
                position: "top",
                fill: "var(--accent)",
                fontSize: 11,
                fontFamily: "var(--font-geist-mono)",
              }}
            />
          ) : null}
          {data.p99 > 0 ? (
            <ReferenceLine
              x={data.bins[p99Bin]?.label}
              stroke="var(--accent)"
              strokeDasharray="3 3"
              label={{
                value: `P99 ${formatTokens(data.p99)}`,
                position: "top",
                fill: "var(--accent)",
                fontSize: 11,
                fontFamily: "var(--font-geist-mono)",
              }}
            />
          ) : null}
          <Bar dataKey="count" fill="var(--accent)" isAnimationActive={false}>
            {data.bins.map((_, i) => (
              <Cell
                key={i}
                fill="var(--accent)"
                stroke={i === p99Bin ? "var(--accent)" : "transparent"}
                strokeWidth={i === p99Bin ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
