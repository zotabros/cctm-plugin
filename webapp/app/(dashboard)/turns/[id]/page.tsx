export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { HairlineCard } from "@/components/primitives/HairlineCard";
import { formatUsd, formatTokens } from "@/lib/format";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SpanRow {
  kind: "tool" | "subagent";
  id: string;
  label: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMs?: number | null;
  cost: number;
}

export default async function TurnDetailPage({ params }: PageProps) {
  const { id } = await params;
  const turn = await prisma.turn.findUnique({
    where: { id },
    include: {
      session: { include: { project: true } },
      toolCalls: { orderBy: { startedAt: "asc" } },
      subagents: { orderBy: { startedAt: "asc" } },
    },
  });
  if (!turn) notFound();

  const spans: SpanRow[] = [
    ...turn.toolCalls.map<SpanRow>((t) => ({
      kind: "tool",
      id: t.id,
      label: t.mcpServer ? `${t.mcpServer}/${t.mcpToolName ?? t.toolName}` : t.toolName,
      startedAt: t.startedAt,
      endedAt: t.endedAt,
      durationMs: t.durationMs,
      cost: t.attributedCostUsd || 0,
    })),
    ...turn.subagents.map<SpanRow>((s) => ({
      kind: "subagent",
      id: s.id,
      label: `subagent: ${s.agentType}`,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      cost: s.attributedCostUsd || 0,
    })),
  ].sort((a, b) => +a.startedAt - +b.startedAt);

  // Compute time scale.
  const t0 = +turn.promptStartedAt;
  const t1 = turn.promptEndedAt ? +turn.promptEndedAt : Math.max(t0, ...spans.map((s) => s.endedAt ? +s.endedAt : t0));
  const span = Math.max(1, t1 - t0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Turn #${turn.ordinal}`}
        subtitle={`${turn.session.project.name} · latency ${turn.latencyMs ?? "—"}ms · cost ${formatUsd(turn.totalCostUsd || 0)}`}
      />

      <HairlineCard>
        <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">Prompt</div>
        <pre className="mt-3 whitespace-pre-wrap text-[13px] text-fg">{turn.userPromptPreview}</pre>
      </HairlineCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <HairlineCard>
          <div className="font-sans text-[11px] uppercase text-fg-muted">Input tokens</div>
          <div className="mt-2 font-mono text-[20px]">{formatTokens(turn.totalInputTokens)}</div>
        </HairlineCard>
        <HairlineCard>
          <div className="font-sans text-[11px] uppercase text-fg-muted">Output tokens</div>
          <div className="mt-2 font-mono text-[20px]">{formatTokens(turn.totalOutputTokens)}</div>
        </HairlineCard>
        <HairlineCard>
          <div className="font-sans text-[11px] uppercase text-fg-muted">Cache (R/W)</div>
          <div className="mt-2 font-mono text-[20px]">
            {formatTokens(turn.totalCacheReadTokens)} / {formatTokens(turn.totalCacheWriteTokens)}
          </div>
        </HairlineCard>
        <HairlineCard>
          <div className="font-sans text-[11px] uppercase text-fg-muted">Cost</div>
          <div className="mt-2 font-mono text-[20px]">{formatUsd(turn.totalCostUsd || 0)}</div>
        </HairlineCard>
      </div>

      <HairlineCard>
        <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
          Timeline (Gantt)
        </div>
        <div className="mt-4 space-y-1">
          {spans.length === 0 ? (
            <div className="text-[13px] text-fg-muted">No tool calls or subagent spans recorded.</div>
          ) : spans.map((s) => {
            const left = ((+s.startedAt - t0) / span) * 100;
            const width = Math.max(0.5, ((s.endedAt ? +s.endedAt : t1) - +s.startedAt) / span * 100);
            const color = s.kind === "subagent" ? "var(--accent)" : "var(--fg)";
            return (
              <div key={s.id} className="flex items-center gap-3">
                <div className="w-56 truncate text-[12px] text-fg-muted">{s.label}</div>
                <div className="relative h-4 flex-1 rounded bg-surface-2">
                  <div
                    className="absolute inset-y-0 rounded"
                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color, opacity: 0.7 }}
                    title={`${s.label} • ${s.durationMs ?? "?"}ms`}
                  />
                </div>
                <div className="w-20 text-right font-mono text-[11px]">{formatUsd(s.cost)}</div>
              </div>
            );
          })}
        </div>
      </HairlineCard>

      <HairlineCard className="p-0">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-fg-muted">
              <th className="px-4 py-3">Tool</th>
              <th className="px-4 py-3">MCP</th>
              <th className="px-4 py-3 text-right">Duration</th>
              <th className="px-4 py-3 text-right">In</th>
              <th className="px-4 py-3 text-right">Out</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {turn.toolCalls.map((t) => (
              <tr key={t.id} className="border-b border-border/60 last:border-b-0">
                <td className="px-4 py-3 font-mono">{t.toolName}</td>
                <td className="px-4 py-3 font-mono text-fg-muted">{t.mcpServer ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono">{t.durationMs ?? "—"}ms</td>
                <td className="px-4 py-3 text-right font-mono">{formatTokens(t.attributedInputTokens)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatTokens(t.attributedOutputTokens)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatUsd(t.attributedCostUsd || 0)}</td>
                <td className="px-4 py-3 text-fg-muted">{t.success === null ? "—" : t.success ? "ok" : (t.errorPreview || "error")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </HairlineCard>
    </div>
  );
}
