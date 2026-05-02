export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { HairlineCard } from "@/components/primitives/HairlineCard";
import { EmptyState } from "@/components/primitives/EmptyState";
import { formatUsd, formatTokens } from "@/lib/format";
import { formatDateTime } from "@/lib/format-time";

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export default async function TurnsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = sp.sort === "latency" ? "latency" : "date";

  const [rows, total] = await Promise.all([
    prisma.turn.findMany({
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: sort === "latency" ? { latencyMs: "desc" } : { promptStartedAt: "desc" },
      include: { session: { include: { project: true } } },
    }),
    prisma.turn.count(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Turns"
        subtitle={`${total} turns total · sort by ${sort}`}
      />
      <HairlineCard className="p-0">
        {rows.length === 0 ? (
          <div className="p-8"><EmptyState message="No turns yet. Use Claude Code with the cctm plugin enabled." /></div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-fg-muted">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Prompt</th>
                <th className="px-4 py-3 text-right">Tokens</th>
                <th className="px-4 py-3 text-right">Latency</th>
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-b-0 hover:bg-surface-2">
                  <td className="px-4 py-3 font-mono text-[11px] text-fg-muted">
                    <Link href={`/turns/${t.id}`}>{formatDateTime(t.promptStartedAt)}</Link>
                  </td>
                  <td className="px-4 py-3">{t.session.project.name}</td>
                  <td className="px-4 py-3 truncate max-w-[480px] text-fg-muted">{t.userPromptPreview}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatTokens((t.totalInputTokens || 0) + (t.totalOutputTokens || 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{t.latencyMs ? `${t.latencyMs}ms` : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatUsd(t.totalCostUsd || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </HairlineCard>
    </div>
  );
}
