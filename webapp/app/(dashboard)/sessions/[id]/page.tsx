export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { HairlineCard } from "@/components/primitives/HairlineCard";
import { AccountChip } from "@/components/primitives/AccountChip";
import { ModelBadge } from "@/components/primitives/ModelBadge";
import { CopyButton } from "@/components/primitives/CopyButton";
import { CumulativeSparkline } from "@/components/charts/CumulativeSparkline";
import { TurnTimeline } from "@/components/sessions/TurnTimeline";
import { getSessionDetail } from "@/lib/efficiency-queries";
import { formatTokens, formatUsd, formatCount, formatPct } from "@/lib/format";
import { formatDuration } from "@/lib/format-time";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailPage({ params }: PageProps) {
  const session = await auth();
  const userId = session.user.id;

  const { id } = await params;
  // getSessionDetail validates ownership via Prisma where clause
  // (project.account.userId === userId).
  const detail = await getSessionDetail(id, userId);
  if (!detail) notFound();

  const { session: s, account, machine, project, turns, aggregates } = detail;
  const totalBreakdown =
    aggregates.breakdown.input +
    aggregates.breakdown.cacheCreation +
    aggregates.breakdown.cacheRead +
    aggregates.breakdown.output;
  const pct = (n: number) =>
    totalBreakdown === 0 ? 0 : (n / totalBreakdown) * 100;

  // Cumulative tokens series across turns.
  const cumulative: number[] = [];
  let acc = 0;
  for (const t of turns) {
    acc += t.totalTokens;
    cumulative.push(acc);
  }

  const breakdownRows: { key: string; label: string; value: number }[] = [
    { key: "input", label: "input", value: aggregates.breakdown.input },
    { key: "cacheCreation", label: "cache_creation", value: aggregates.breakdown.cacheCreation },
    { key: "cacheRead", label: "cache_read", value: aggregates.breakdown.cacheRead },
    { key: "output", label: "output", value: aggregates.breakdown.output },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        subtitle={`${s.uuid}`}
        actions={
          <Link
            href="/sessions"
            className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 font-mono text-[12px] text-fg hover:border-border-strong"
          >
            ← Back
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <AccountChip color={account.color} label={account.label} />
        <span className="font-mono text-[12px] text-fg-muted">{machine.label}</span>
        <ModelBadge model={s.model} />
        <CopyButton value={s.uuid} label="Copy UUID" />
      </div>

      {/* 3 small metric cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <HairlineCard>
          <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Total tokens
          </div>
          <div className="mt-2 font-sans text-[28px] font-medium leading-none font-tabular text-fg">
            {formatTokens(aggregates.totalTokens)}
          </div>
          <div className="mt-1 font-mono text-[11px] text-fg-subtle">
            {formatCount(turns.length)} turns
          </div>
        </HairlineCard>
        <HairlineCard>
          <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Cost
          </div>
          <div className="mt-2 font-sans text-[28px] font-medium leading-none font-tabular text-fg">
            {formatUsd(aggregates.totalCost)}
          </div>
          <div className="mt-1 font-mono text-[11px] text-fg-subtle">
            cache hit {formatPct(aggregates.cacheHitPct)}
          </div>
        </HairlineCard>
        <HairlineCard>
          <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Duration
          </div>
          <div className="mt-2 font-sans text-[28px] font-medium leading-none font-tabular text-fg">
            {formatDuration(aggregates.durationSec)}
          </div>
          <div className="mt-1 font-mono text-[11px] text-fg-subtle">
            since {new Date(s.startedAt).toLocaleString()}
          </div>
        </HairlineCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <HairlineCard className="p-0 lg:col-span-9">
          <div className="px-3 py-3 border-b border-border">
            <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
              Turn timeline
            </div>
          </div>
          {turns.length === 0 ? (
            <div className="p-6 font-mono text-[12px] text-fg-subtle">
              No turns recorded.
            </div>
          ) : (
            <TurnTimeline turns={turns} />
          )}
        </HairlineCard>

        <div className="lg:col-span-3">
          <HairlineCard className="sticky top-32">
            <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
              Breakdown
            </div>
            <div className="mt-3 space-y-1.5">
              {breakdownRows.map((b) => (
                <div
                  key={b.key}
                  className="flex items-center justify-between font-mono text-[12px]"
                >
                  <span className="text-fg-muted">{b.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-tabular text-fg">{formatTokens(b.value)}</span>
                    <span className="w-10 text-right font-tabular text-fg-subtle">
                      {pct(b.value).toFixed(1)}%
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
                Cumulative
              </div>
              <div className="mt-2">
                <CumulativeSparkline data={cumulative} height={80} />
              </div>
            </div>

            <div className="mt-5">
              <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
                Cache hit
              </div>
              <div className="mt-1 font-mono text-[14px] font-tabular text-fg">
                {formatPct(aggregates.cacheHitPct)}
              </div>
            </div>

            <div className="mt-5">
              <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
                Top tools
              </div>
              {aggregates.topTools.length === 0 ? (
                <div className="mt-2 font-mono text-[11px] text-fg-subtle">none</div>
              ) : (
                <ul className="mt-2 space-y-1">
                  {aggregates.topTools.map((t) => (
                    <li
                      key={t.tool}
                      className="flex items-center justify-between font-mono text-[12px]"
                    >
                      <span className="text-fg">{t.tool}</span>
                      <span className="font-tabular text-fg-muted">
                        {formatCount(t.count)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 border-t border-border pt-3 font-mono text-[10px] text-fg-subtle">
              project: {project.cwdPath}
            </div>
          </HairlineCard>
        </div>
      </div>
    </div>
  );
}
