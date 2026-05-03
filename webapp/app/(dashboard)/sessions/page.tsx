export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { HairlineCard } from "@/components/primitives/HairlineCard";
import { EmptyState } from "@/components/primitives/EmptyState";
import { AccountChip } from "@/components/primitives/AccountChip";
import { ModelBadge } from "@/components/primitives/ModelBadge";
import { DateRangePicker } from "@/components/filters/DateRangePicker";
import { FilterBar } from "@/components/filters/FilterBar";
import { DataTable, type DataColumn } from "@/components/tables/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { getSessionsList, type SessionRow } from "@/lib/efficiency-queries";
import { getFilterOptions, type UsageFilters } from "@/lib/queries";
import { parseRangeParams, rangeLabel } from "@/lib/range";
import { formatTokens, formatUsd, formatCount } from "@/lib/format";
import { formatDateTime, formatDuration } from "@/lib/format-time";
import { csv } from "@/lib/utils";

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    accounts?: string;
    machines?: string;
    models?: string;
    projects?: string;
    page?: string;
  }>;
}

function buildBaseHref(sp: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "page") continue;
    if (typeof v === "string" && v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/sessions?${qs}` : "/sessions";
}

export default async function SessionsPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session.user.id;

  const sp = await searchParams;
  const range = parseRangeParams(sp);
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const filters: UsageFilters = {
    accountIds: csv(sp.accounts),
    machineIds: csv(sp.machines),
    models: csv(sp.models),
    projectIds: csv(sp.projects),
  };

  const [{ rows, total }, options] = await Promise.all([
    getSessionsList(userId, range, filters, page, PAGE_SIZE),
    getFilterOptions(userId),
  ]);

  const baseHref = buildBaseHref(sp);

  const columns: DataColumn<SessionRow>[] = [
    {
      key: "started",
      header: "Started",
      mono: true,
      render: (r) => (
        <Link
          href={`/sessions/${r.sessionId}`}
          className="text-fg hover:text-accent"
        >
          {formatDateTime(r.startedAt)}
        </Link>
      ),
    },
    {
      key: "account",
      header: "Account",
      render: (r) => <AccountChip color={r.accountColor} label={r.accountLabel} />,
    },
    {
      key: "machine",
      header: "Machine",
      mono: true,
      render: (r) => <span className="text-fg">{r.machineLabel}</span>,
    },
    {
      key: "project",
      header: "Project",
      mono: true,
      render: (r) => (
        <span
          className="block max-w-[220px] truncate text-fg"
          title={r.projectName}
        >
          {r.projectName}
        </span>
      ),
    },
    {
      key: "model",
      header: "Model",
      render: (r) => <ModelBadge model={r.model} />,
    },
    {
      key: "turns",
      header: "Turns",
      align: "right",
      mono: true,
      render: (r) => formatCount(r.turns),
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
      render: (r) => formatUsd(r.costUsd),
    },
    {
      key: "duration",
      header: "Duration",
      align: "right",
      mono: true,
      render: (r) => formatDuration(r.durationSec),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
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

      <HairlineCard className="p-0">
        <DataTable<SessionRow>
          rowKey={(r) => r.sessionId}
          rows={rows}
          columns={columns}
          empty={
            <div className="p-6">
              <EmptyState message="No sessions match these filters" />
            </div>
          }
        />
        {rows.length > 0 ? (
          <div className="px-3 pb-3">
            <Pagination
              page={page}
              total={total}
              pageSize={PAGE_SIZE}
              baseHref={baseHref}
            />
          </div>
        ) : null}
      </HairlineCard>
    </div>
  );
}
