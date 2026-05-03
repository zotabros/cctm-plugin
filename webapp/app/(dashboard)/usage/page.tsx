export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { HairlineCard } from "@/components/primitives/HairlineCard";
import { EmptyState } from "@/components/primitives/EmptyState";
import { DateRangePicker } from "@/components/filters/DateRangePicker";
import { GroupByToggle } from "@/components/filters/GroupByToggle";
import { FilterBar } from "@/components/filters/FilterBar";
import { StackByTabs } from "@/components/filters/StackByTabs";
import { UsageOverTime } from "@/components/charts/UsageOverTime";
import {
  getUsageOverTime,
  getFilterOptions,
  type GroupBy,
  type StackBy,
  type UsageFilters,
} from "@/lib/queries";
import { parseRangeParams, rangeLabel } from "@/lib/range";
import { formatTokens } from "@/lib/format";
import { csv } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    groupBy?: string;
    stackBy?: string;
    accounts?: string;
    machines?: string;
    models?: string;
    projects?: string;
  }>;
}

const VALID_GROUPBY: GroupBy[] = ["hour", "day", "week", "month"];
const VALID_STACKBY: StackBy[] = ["model", "account", "project"];

export default async function UsagePage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session.user.id;

  const sp = await searchParams;
  const range = parseRangeParams(sp);
  const groupBy = (VALID_GROUPBY.includes(sp.groupBy as GroupBy)
    ? sp.groupBy
    : "day") as GroupBy;
  const stackBy = (VALID_STACKBY.includes(sp.stackBy as StackBy)
    ? sp.stackBy
    : "model") as StackBy;

  const filters: UsageFilters = {
    accountIds: csv(sp.accounts),
    machineIds: csv(sp.machines),
    models: csv(sp.models),
    projectIds: csv(sp.projects),
  };

  const [{ buckets, series }, options] = await Promise.all([
    getUsageOverTime(userId, range, groupBy, filters, stackBy),
    getFilterOptions(userId),
  ]);

  // Aggregate totals per series for sticky summary.
  const totalsByKey = new Map<string, number>();
  let grandTotal = 0;
  for (const b of buckets) {
    for (const s of series) {
      const v = Number(b[s.key] ?? 0);
      totalsByKey.set(s.key, (totalsByKey.get(s.key) ?? 0) + v);
      grandTotal += v;
    }
  }
  const breakdown = series
    .map((s) => ({
      ...s,
      tokens: totalsByKey.get(s.key) ?? 0,
      pct: grandTotal === 0 ? 0 : ((totalsByKey.get(s.key) ?? 0) / grandTotal) * 100,
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader title="Usage" subtitle={rangeLabel(range)} />

      {/* Sticky filter sub-bar */}
      <div className="sticky top-14 z-20 -mx-8 border-b border-border bg-bg/95 px-8 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterBar
            accounts={options.accounts}
            machines={options.machines}
            models={options.models}
            projects={options.projects}
          />
          <div className="flex items-center gap-2">
            <GroupByToggle />
            <DateRangePicker />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <HairlineCard className="lg:col-span-8">
          <StackByTabs />
          <div className="mt-4">
            {buckets.length === 0 ? (
              <EmptyState message="No usage in this range" />
            ) : (
              <UsageOverTime buckets={buckets} series={series} groupBy={groupBy} />
            )}
          </div>
        </HairlineCard>

        <HairlineCard className="lg:col-span-4">
          <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Total tokens
          </div>
          <div className="mt-2 font-serif text-[44px] font-light leading-none font-tabular text-fg">
            {formatTokens(grandTotal)}
          </div>
          <div className="mt-6 space-y-2">
            <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
              Breakdown
            </div>
            {breakdown.length === 0 ? (
              <EmptyState message="No breakdown" />
            ) : (
              breakdown.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="flex-1 truncate font-mono text-[12px] text-fg">
                    {s.label}
                  </span>
                  <span className="font-mono text-[11px] font-tabular text-fg-muted">
                    {formatTokens(s.tokens)}
                  </span>
                  <span className="w-10 text-right font-mono text-[11px] font-tabular text-fg">
                    {s.pct.toFixed(1)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </HairlineCard>
      </div>
    </div>
  );
}
