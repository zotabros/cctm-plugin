export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { HairlineCard } from "@/components/primitives/HairlineCard";
import { EmptyState } from "@/components/primitives/EmptyState";
import { formatUsd } from "@/lib/format";

export default async function ToolsPage() {
  const rows = await prisma.toolInvocation.groupBy({
    by: ["toolName", "mcpServer"],
    _count: { _all: true },
    _avg: { durationMs: true },
    _sum: { attributedCostUsd: true, attributedInputTokens: true, attributedOutputTokens: true },
    orderBy: { _sum: { attributedCostUsd: "desc" } },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Tools" subtitle="Per-tool cost and latency rollup (all time)" />
      <HairlineCard className="p-0">
        {rows.length === 0 ? (
          <div className="p-8"><EmptyState message="No tool invocations recorded yet." /></div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-fg-muted">
                <th className="px-4 py-3">Tool</th>
                <th className="px-4 py-3">MCP</th>
                <th className="px-4 py-3 text-right">Calls</th>
                <th className="px-4 py-3 text-right">Avg ms</th>
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.toolName}::${r.mcpServer ?? ""}`} className="border-b border-border/60 last:border-b-0">
                  <td className="px-4 py-3 font-mono">{r.toolName}</td>
                  <td className="px-4 py-3 font-mono text-fg-muted">{r.mcpServer ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{r._count._all}</td>
                  <td className="px-4 py-3 text-right font-mono">{Math.round(r._avg.durationMs ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatUsd(r._sum.attributedCostUsd ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </HairlineCard>
    </div>
  );
}
