"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTokens, formatPct } from "@/lib/format";
import type { CacheHitPoint } from "@/lib/efficiency-queries";
import { formatDateShort } from "@/lib/format-time";

interface CacheHitTrendProps {
  data: CacheHitPoint[];
  height?: number;
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
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value;
  return (
    <div className="rounded-md border border-accent bg-surface px-3 py-2 font-mono text-[11px] text-fg">
      <div className="mb-1 text-fg-muted">{label ? formatDateShort(label) : ""}</div>
      <Row label="cache_read"     value={formatTokens(Number(get("cacheRead") ?? 0))} dot="var(--positive)" />
      <Row label="input"          value={formatTokens(Number(get("input") ?? 0))} dot="var(--accent)" />
      <Row label="cache_creation" value={formatTokens(Number(get("cacheCreation") ?? 0))} dot="var(--accent-soft)" />
      <Row label="hit %"          value={formatPct(Number(get("hitPct") ?? 0))} dot="var(--text-subtle)" />
    </div>
  );
}

function Row({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
      <span className="flex-1 text-fg-muted">{label}</span>
      <span className="font-tabular">{value}</span>
    </div>
  );
}

export function CacheHitTrend({ data, height = 360 }: CacheHitTrendProps) {
  // Detect adoption point: first day where cacheRead > 0.
  const adoption = data.find((d) => d.cacheRead > 0)?.day ?? null;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 8, left: 0 }} barCategoryGap="14%">
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(v: string) => formatDateShort(v)}
            stroke="var(--border-strong)"
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            tickFormatter={(v: number) => formatTokens(v)}
            stroke="var(--border-strong)"
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            stroke="var(--border-strong)"
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
            tickLine={false}
            axisLine={false}
            width={42}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={<ChartTooltip />}
          />
          <Bar
            yAxisId="left"
            dataKey="cacheRead"
            stackId="tokens"
            fill="var(--positive)"
            isAnimationActive={false}
          />
          <Bar
            yAxisId="left"
            dataKey="input"
            stackId="tokens"
            fill="var(--accent)"
            isAnimationActive={false}
          />
          <Bar
            yAxisId="left"
            dataKey="cacheCreation"
            stackId="tokens"
            fill="var(--accent-soft)"
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="hitPct"
            stroke="var(--text)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          {adoption ? (
            <ReferenceLine
              yAxisId="left"
              x={adoption}
              stroke="var(--accent)"
              strokeDasharray="3 3"
              label={{
                value: "caching adopted →",
                position: "insideTopRight",
                fill: "var(--accent)",
                fontSize: 11,
                fontFamily: "var(--font-geist-mono)",
              }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
