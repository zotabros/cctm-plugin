export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { HairlineCard } from "@/components/primitives/HairlineCard";
import { EmptyState } from "@/components/primitives/EmptyState";
import { DateRangePicker } from "@/components/filters/DateRangePicker";
import { FilterBar } from "@/components/filters/FilterBar";
import { CostTreemap } from "@/components/charts/CostTreemap";
import { CacheHitTrend } from "@/components/charts/CacheHitTrend";
import { TokenHistogram } from "@/components/charts/TokenHistogram";
import { ToolBreakdown } from "@/components/charts/ToolBreakdown";
import { InsightsList } from "@/components/insights/InsightsList";
import {
  getCostAllocation,
  getCacheHitTrend,
  getTokensPerTurnHistogram,
  getToolBreakdown,
} from "@/lib/efficiency-queries";
import { getInsights } from "@/lib/insights";
import { getFilterOptions, type UsageFilters } from "@/lib/queries";
import { parseRangeParams, rangeLabel } from "@/lib/range";
import { csv } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    accounts?: string;
    machines?: string;
    models?: string;
    projects?: string;
  }>;
}

export default async function EfficiencyPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session.user.id;

  const sp = await searchParams;
  const range = parseRangeParams(sp);
  const filters: UsageFilters = {
    accountIds: csv(sp.accounts),
    machineIds: csv(sp.machines),
    models: csv(sp.models),
    projectIds: csv(sp.projects),
  };

  const [allocation, cacheTrend, histogram, tools, insights, options] =
    await Promise.all([
      getCostAllocation(userId, range, filters),
      getCacheHitTrend(userId, range, filters),
      getTokensPerTurnHistogram(userId, range, filters),
      getToolBreakdown(userId, range, filters),
      getInsights(userId, range),
      getFilterOptions(userId),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Efficiency"
        subtitle={rangeLabel(range)}
        actions={<DateRangePicker />}
      />

      <div className="sticky top-14 z-20 -mx-8 border-b border-border bg-bg/95 px-8 py-3 backdrop-blur">
        <FilterBar
          accounts={options.accounts}
          machines={options.machines}
          models={options.models}
          projects={options.projects}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <HairlineCard className="lg:col-span-7">
          <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Cost allocation
          </div>
          <div className="mt-4">
            {allocation.length === 0 ? (
              <EmptyState message="No cost data in this range" />
            ) : (
              <CostTreemap data={allocation} height={360} />
            )}
          </div>
        </HairlineCard>

        <HairlineCard className="lg:col-span-5">
          <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Cache hit rate trend
          </div>
          <div className="mt-4">
            {cacheTrend.length === 0 ? (
              <EmptyState message="No cache data yet" />
            ) : (
              <CacheHitTrend data={cacheTrend} height={360} />
            )}
          </div>
        </HairlineCard>

        <HairlineCard className="lg:col-span-6">
          <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Tokens per turn
          </div>
          <div className="mt-4">
            {histogram.totalTurns === 0 ? (
              <EmptyState message="No turns recorded" />
            ) : (
              <TokenHistogram data={histogram} height={320} />
            )}
          </div>
        </HairlineCard>

        <HairlineCard className="lg:col-span-6">
          <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Tool & MCP usage
          </div>
          <div className="mt-4">
            {tools.length === 0 ? (
              <EmptyState message="No tool calls recorded" />
            ) : (
              <ToolBreakdown data={tools} height={320} />
            )}
          </div>
        </HairlineCard>
      </div>

      <HairlineCard>
        <div className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
          Insights
        </div>
        <div className="mt-2">
          <InsightsList items={insights} />
        </div>
      </HairlineCard>
    </div>
  );
}
