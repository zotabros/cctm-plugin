"use client";

import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { formatUsd } from "@/lib/format";
import type { TreemapNode } from "@/lib/efficiency-queries";

interface CostTreemapProps {
  data: TreemapNode[];
  height?: number;
}

interface TreemapDatum {
  name: string;
  size: number;
  color?: string;
  parent?: string;
  children?: TreemapDatum[];
}

function buildTree(flat: TreemapNode[]): TreemapDatum {
  // Group leaf project nodes under each account-id parent.
  const accounts = new Map<string, TreemapDatum>();
  // First pass: account-level nodes (parent === 'root') seed accounts map.
  for (const n of flat) {
    if (n.parent === "root") {
      accounts.set(n.name, { name: n.name, size: 0, color: n.color, children: [] });
    }
  }
  // Second pass: leaves attach to their account by name lookup.
  // We rely on the queries layer emitting account label as `name` for the root nodes
  // and child nodes' `parent` as the account id. We rebuild the mapping by scanning
  // root nodes again to recover label -> children.
  // Simpler: iterate flat and group by the (parent !== 'root') project nodes by color
  // (each account picks a single color, so treemap tints stay consistent).
  const rootNodes: TreemapDatum[] = [];
  // Map id-to-bucket via account-color since flat list lacks ids in name-only form.
  // To keep ordering stable, use parent string as the bucket key.
  const buckets = new Map<string, TreemapDatum>();
  for (const n of flat) {
    if (n.parent === "root") continue;
    const key = n.parent;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { name: key, size: 0, color: n.color, children: [] };
      buckets.set(key, bucket);
    }
    bucket.children!.push({
      name: n.name,
      size: Math.max(0.0001, n.value),
      color: n.color,
    });
  }
  // Replace bucket "name" (account id) with the friendly label by matching root nodes.
  // We trust the order of flat: account roots came first.
  const accountLabelByOrder = flat.filter((n) => n.parent === "root").map((n) => n.name);
  let i = 0;
  for (const [, bucket] of buckets) {
    bucket.name = accountLabelByOrder[i] ?? bucket.name;
    rootNodes.push(bucket);
    i += 1;
  }
  void accounts;
  return { name: "root", size: 0, children: rootNodes };
}

interface TooltipPayload {
  active?: boolean;
  payload?: { payload?: TreemapDatum }[];
}

function ChartTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload || !payload.length) return null;
  const node = payload[0]?.payload;
  if (!node) return null;
  return (
    <div className="rounded-md border border-accent bg-surface px-3 py-2 font-mono text-[11px] text-fg">
      <div className="text-fg">{node.name}</div>
      <div className="font-tabular text-fg-muted">{formatUsd(node.size ?? 0)}</div>
    </div>
  );
}

interface ContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  size?: number;
  color?: string;
  root?: TreemapDatum;
}

function ContentNode(props: ContentProps) {
  const { x = 0, y = 0, width = 0, height = 0, depth = 0, name, size = 0, root } = props;
  if (depth === 0) return null;
  // Find the maximum leaf value to scale the tint intensity.
  let max = 1;
  for (const acc of root?.children ?? []) {
    for (const leaf of acc.children ?? []) {
      if (leaf.size > max) max = leaf.size;
    }
  }
  const intensity = Math.min(1, Math.max(0.08, size / max));
  const fill = `color-mix(in oklch, var(--accent) ${Math.round(intensity * 90)}%, var(--surface))`;

  const showLabel = width > 70 && height > 28;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="var(--bg)"
        strokeWidth={1}
      />
      {showLabel ? (
        <text
          x={x + 6}
          y={y + 16}
          fill="var(--text)"
          fontSize={11}
          fontFamily="var(--font-geist-mono)"
        >
          {name}
        </text>
      ) : null}
    </g>
  );
}

export function CostTreemap({ data, height = 360 }: CostTreemapProps) {
  const tree = buildTree(data);
  if (!tree.children || tree.children.length === 0) {
    return null;
  }
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={tree.children}
          dataKey="size"
          isAnimationActive={false}
          stroke="var(--bg)"
          content={<ContentNode />}
        >
          <Tooltip content={<ChartTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
