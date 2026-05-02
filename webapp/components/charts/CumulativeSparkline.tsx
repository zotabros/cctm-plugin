"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface CumulativeSparklineProps {
  data: number[];
  height?: number;
  color?: string;
}

// Mini cumulative area chart (no axes, no grid).
export function CumulativeSparkline({
  data,
  height = 80,
  color = "var(--accent)",
}: CumulativeSparklineProps) {
  const id = useId().replace(/:/g, "");
  const points =
    data.length === 0
      ? [{ i: 0, v: 0 }]
      : data.map((v, i) => ({ i, v }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={`csl-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#csl-${id})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
