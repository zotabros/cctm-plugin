export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { HairlineCard } from "@/components/primitives/HairlineCard";
import { EmptyState } from "@/components/primitives/EmptyState";
import { formatUsd, formatTokens } from "@/lib/format";

export default async function SubagentsPage() {
  const rows = await prisma.subagentSpan.groupBy({
    by: ["agentType"],
    _count: { _all: true },
    _sum: { attributedCostUsd: true, attributedInputTokens: true, attributedOutputTokens: true },
    orderBy: { _sum: { attributedCostUsd: "desc" } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Subagents" subtitle="Cost rollups by agent type" />
      <HairlineCard className="p-0">
        {rows.length === 0 ? (
          <div className="p-8"><EmptyState message="No subagent spans recorded yet." /></div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-fg-muted">
                <th className="px-4 py-3">Agent type</th>
                <th className="px-4 py-3 text-right">Spans</th>
                <th className="px-4 py-3 text-right">In</th>
                <th className="px-4 py-3 text-right">Out</th>
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.agentType} className="border-b border-border/60 last:border-b-0">
                  <td className="px-4 py-3 font-mono">{r.agentType}</td>
                  <td className="px-4 py-3 text-right font-mono">{r._count._all}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatTokens(r._sum.attributedInputTokens ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatTokens(r._sum.attributedOutputTokens ?? 0)}</td>
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
