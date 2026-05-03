export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { HairlineCard } from "@/components/primitives/HairlineCard";
import { Metric } from "@/components/primitives/Metric";
import { DiffPill } from "@/components/primitives/DiffPill";
import { AccountChip } from "@/components/primitives/AccountChip";
import { ModelBadge } from "@/components/primitives/ModelBadge";
import { Sparkline } from "@/components/primitives/Sparkline";
import { EmptyState } from "@/components/primitives/EmptyState";
import { DataTable, type DataColumn } from "@/components/tables/DataTable";
import { DateRangePicker } from "@/components/filters/DateRangePicker";
import {
  getOverviewMetrics,
  getTopAccounts,
  getTopProjects,
  getTopMachines,
  getRecentSessions,
  type TopProject,
  type TopMachine,
  type RecentSession,
} from "@/lib/queries";
import { parseRangeParams, rangeLabel } from "@/lib/range";
import { formatTokens, formatUsd, formatCount, formatPct } from "@/lib/format";

interface PageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}

export default async function OverviewPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session.user.id;

  const sp = await searchParams;
  const range = parseRangeParams(sp);

  const [metrics, topAccounts, topProjects, topMachines, recent, accountCount] =
    await Promise.all([
      getOverviewMetrics(userId, range),
      getTopAccounts(userId, range, 5),
      getTopProjects(userId, range, 6),
      getTopMachines(userId, range, 5),
      getRecentSessions(userId, 8),
      prisma.account.count(),
    ]);

  const sparkValues = metrics.sparkline30d.map((p: { tokens: number }) => p.tokens);
  const subtitle = `${rangeLabel(range)} · ${accountCount} accounts · local`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle={subtitle}
        actions={<DateRangePicker />}
      />

      {/* Hero metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Metric
          eyebrow="Total tokens"
          value={formatTokens(metrics.totalTokens)}
          diff={<DiffPill value={metrics.deltaTokensPct} format="pct" positiveIsGood={false} />}
          spark={sparkValues}
        />
        <Metric
          eyebrow="Cost"
          value={formatUsd(metrics.totalCost)}
          diff={<DiffPill value={metrics.deltaCostPct} format="pct" positiveIsGood={false} />}
        />
        <Metric
          eyebrow="Sessions"
          value={formatCount(metrics.sessions)}
          diff={<DiffPill value={metrics.deltaSessions} format="count" positiveIsGood />}
        />
        <Metric
          eyebrow="Cache hit"
          value={formatPct(metrics.cacheHitPct)}
          diff={<DiffPill value={metrics.deltaCacheHitPp} format="pp" positiveIsGood />}
          sparkColor="var(--positive)"
        />
      </div>

      {/* Top accounts (3) + Usage trend (9) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <HairlineCard className="lg:col-span-3">
          <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Top accounts
          </div>
          <div className="mt-4 space-y-3">
            {topAccounts.length === 0 ? (
              <EmptyState message="No usage in this range" />
            ) : (
              topAccounts.map((a) => (
                <div key={a.accountId} className="flex items-center gap-3">
                  <AccountChip color={a.color} label={a.label} className="w-32 truncate" />
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${Math.max(2, a.pctOfTotal).toFixed(1)}%`,
                        backgroundColor: a.color,
                      }}
                    />
                  </div>
                  <div className="w-12 text-right font-mono text-[12px] font-tabular text-fg">
                    {a.pctOfTotal.toFixed(0)}%
                  </div>
                </div>
              ))
            )}
          </div>
        </HairlineCard>

        <HairlineCard className="lg:col-span-9">
          <div className="flex items-center justify-between">
            <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
              Usage trend (30d)
            </div>
            <div className="font-mono text-[11px] text-fg-subtle">
              tokens / day
            </div>
          </div>
          <div className="mt-4">
            {sparkValues.length === 0 ? (
              <EmptyState message="No data in the last 30 days" />
            ) : (
              <Sparkline data={sparkValues} height={200} />
            )}
          </div>
        </HairlineCard>
      </div>

      {/* Three table columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <HairlineCard className="lg:col-span-4">
          <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Top projects
          </div>
          <div className="mt-2">
            <DataTable<TopProject>
              rowKey={(r) => r.projectId}
              empty={<EmptyState message="No projects yet" />}
              rows={topProjects}
              columns={[
                {
                  key: "name",
                  header: "Project",
                  render: (r) => (
                    <div className="flex flex-col">
                      <span className="truncate text-fg">{r.name}</span>
                      <span className="font-mono text-[10px] text-fg-subtle">
                        {r.accountLabel}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "tokens",
                  header: "Tokens",
                  align: "right",
                  mono: true,
                  render: (r) => formatTokens(r.tokens),
                },
                {
                  key: "cost",
                  header: "Cost",
                  align: "right",
                  mono: true,
                  render: (r) => formatUsd(r.cost),
                },
              ] satisfies DataColumn<TopProject>[]}
            />
          </div>
        </HairlineCard>

        <HairlineCard className="lg:col-span-4">
          <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Top machines
          </div>
          <div className="mt-2">
            <DataTable<TopMachine>
              rowKey={(r) => r.machineId}
              empty={<EmptyState message="No machines reporting" />}
              rows={topMachines}
              columns={[
                {
                  key: "label",
                  header: "Machine",
                  render: (r) => (
                    <div className="flex flex-col">
                      <span className="truncate text-fg">{r.label}</span>
                      <span className="font-mono text-[10px] text-fg-subtle">
                        {r.lastSeenAt
                          ? `seen ${new Date(r.lastSeenAt).toLocaleDateString()}`
                          : "never"}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "tokens",
                  header: "Tokens",
                  align: "right",
                  mono: true,
                  render: (r) => formatTokens(r.tokens),
                },
              ] satisfies DataColumn<TopMachine>[]}
            />
          </div>
        </HairlineCard>

        <HairlineCard className="lg:col-span-4">
          <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Recent sessions
          </div>
          <div className="mt-3 space-y-2">
            {recent.length === 0 ? (
              <EmptyState message="No sessions yet" />
            ) : (
              recent.map((s: RecentSession) => (
                <div
                  key={s.sessionId}
                  className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: s.accountColor }}
                      />
                      <span className="truncate text-[12px] text-fg">{s.projectName}</span>
                      <ModelBadge model={s.model} />
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-fg-subtle">
                      {new Date(s.startedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px] font-tabular">
                    <div className="text-fg">{formatTokens(s.tokens)}</div>
                    <div className="text-fg-subtle">{formatUsd(s.costUsd)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </HairlineCard>
      </div>
    </div>
  );
}
