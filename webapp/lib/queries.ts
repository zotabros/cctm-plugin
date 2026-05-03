// Query layer for the dashboard overview. Uses raw SQL for SQLite compatibility
// because Prisma's lt/lte operators are broken with SQLite text column comparisons.

import { Prisma } from "@prisma/client";
import { prisma, LOCAL_ACCOUNT_ID } from "@/lib/db";
import { ACCOUNT_COLORS } from "@cctm/shared";
import type { DateRange } from "@/lib/range";

export type GroupBy = "hour" | "day" | "week" | "month";
export type StackBy = "model" | "account" | "project";

export interface UsageFilters {
  accountIds?: string[];
  machineIds?: string[];
  models?: string[];
  projectIds?: string[];
}

export interface OverviewMetrics {
  totalTokens: number;
  totalCost: number;
  sessions: number;
  cacheHitPct: number;
  deltaTokensPct: number;
  deltaCostPct: number;
  deltaSessions: number;
  deltaCacheHitPp: number;
  sparkline30d: { date: string; tokens: number }[];
}

export async function getOverviewMetrics(
  _userId: string,
  range: DateRange
): Promise<OverviewMetrics> {
  const from = range.from.toISOString();
  const to = range.to.toISOString();

  const [totals] = await prisma.$queryRaw<
    { totalTokens: number; totalCost: number; sessions: number; cacheRead: number; denom: number }[]
  >`
    SELECT
      COALESCE(SUM(inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens), 0) as totalTokens,
      COALESCE(SUM(costUsd), 0) as totalCost,
      COUNT(DISTINCT sessionId) as sessions,
      COALESCE(SUM(cacheReadTokens), 0) as cacheRead,
      COALESCE(SUM(cacheReadTokens + inputTokens + cacheCreationTokens), 0) as denom
    FROM UsageEvent
    WHERE ts >= ${from} AND ts < ${to}
  `;

  const cacheHitPct = Number(totals.denom) === 0 ? 0 : (Number(totals.cacheRead) / Number(totals.denom)) * 100;

  // 30-day sparkline.
  const since = new Date();
  since.setDate(since.getDate() - 30);
  since.setHours(0, 0, 0, 0);
  const sparkRows = await prisma.$queryRaw<
    { day: string; tokens: number }[]
  >`
    SELECT SUBSTR(ts, 1, 10) as day,
           SUM(inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens) as tokens
    FROM UsageEvent
    WHERE ts >= ${since.toISOString()}
    GROUP BY day
    ORDER BY day ASC
  `;

  return {
    totalTokens: Number(totals.totalTokens),
    totalCost: Number(totals.totalCost),
    sessions: Number(totals.sessions),
    cacheHitPct,
    deltaTokensPct: 0, deltaCostPct: 0, deltaSessions: 0, deltaCacheHitPp: 0,
    sparkline30d: sparkRows.map((r) => ({ date: r.day, tokens: Number(r.tokens) })),
  };
}

export interface UsageBucket { ts: string; [seriesKey: string]: number | string }
export interface UsageSeries { key: string; label: string; color: string }
export interface UsageOverTimeResult { buckets: UsageBucket[]; series: UsageSeries[] }

export async function getUsageOverTime(
  _userId: string,
  range: DateRange,
  groupBy: GroupBy,
  _filters: UsageFilters,
  stackBy: StackBy
): Promise<UsageOverTimeResult> {
  const from = range.from.toISOString();
  const to = range.to.toISOString();

  const groupExpr: Record<GroupBy, string> = {
    hour: "SUBSTR(ts, 1, 13) || ':00:00'",
    day: "SUBSTR(ts, 1, 10)",
    week: "STRFTIME('%Y-W%W', ts)",
    month: "SUBSTR(ts, 1, 7)",
  };
  const stackExpr: Record<StackBy, string> = {
    model: "COALESCE(model, 'unknown')",
    account: "accountId",
    project: "sessionId",
  };

  const rows = await prisma.$queryRawUnsafe<
    { bucket: string; key: string; tokens: number }[]
  >(
    `SELECT ${groupExpr[groupBy]} as bucket,
            ${stackExpr[stackBy]} as key,
            SUM(inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens) as tokens
     FROM UsageEvent
     WHERE ts >= ? AND ts < ?
     GROUP BY bucket, key
     ORDER BY bucket ASC`,
    from, to
  );

  const bucketMap = new Map<string, Map<string, number>>();
  const seriesKeys = new Set<string>();

  for (const r of rows) {
    seriesKeys.add(r.key);
    if (!bucketMap.has(r.bucket)) bucketMap.set(r.bucket, new Map());
    bucketMap.get(r.bucket)!.set(r.key, Number(r.tokens));
  }

  const seriesColors = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
  const series: UsageSeries[] = Array.from(seriesKeys).map((k, i) => ({
    key: k,
    label: k,
    color: seriesColors[i % seriesColors.length],
  }));

  const buckets: UsageBucket[] = Array.from(bucketMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([ts, counts]) => {
      const row: UsageBucket = { ts };
      for (const s of series) row[s.key] = counts.get(s.key) ?? 0;
      return row;
    });

  return { buckets, series };
}

export interface TopAccount {
  accountId: string; label: string; color: string; tokens: number; pctOfTotal: number;
}

export async function getTopAccounts(_userId: string, range: DateRange, _limit = 5): Promise<TopAccount[]> {
  const acct = await prisma.account.findUnique({ where: { id: LOCAL_ACCOUNT_ID } });
  if (!acct) return [];

  const [totals] = await prisma.$queryRaw<{ tokens: number }[]>`
    SELECT COALESCE(SUM(inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens), 0) as tokens
    FROM UsageEvent
    WHERE ts >= ${range.from.toISOString()} AND ts < ${range.to.toISOString()}
  `;
  const totalTokens = Number(totals?.tokens ?? 0);

  return [{
    accountId: acct.id,
    label: acct.label,
    color: acct.color || ACCOUNT_COLORS[0],
    tokens: totalTokens,
    pctOfTotal: 100,
  }];
}

export interface TopProject {
  projectId: string; name: string; accountLabel: string; accountColor: string; tokens: number; cost: number;
}

export async function getTopProjects(_userId: string, range: DateRange, limit = 10): Promise<TopProject[]> {
  const rows = await prisma.$queryRaw<
    { projectId: string; name: string; accountLabel: string; accountColor: string; tokens: number; cost: number }[]
  >`
    SELECT p.id as projectId, p.name, a.label as accountLabel, a.color as accountColor,
           COALESCE(SUM(e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens), 0) as tokens,
           COALESCE(SUM(e.costUsd), 0) as cost
    FROM Project p
    JOIN Account a ON p.accountId = a.id
    LEFT JOIN Session s ON s.projectId = p.id
    LEFT JOIN UsageEvent e ON e.sessionId = s.id AND e.ts >= ${range.from.toISOString()} AND e.ts < ${range.to.toISOString()}
    GROUP BY p.id
    HAVING tokens > 0
    ORDER BY tokens DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ ...r, tokens: Number(r.tokens), cost: Number(r.cost) }));
}

export interface TopMachine { machineId: string; label: string; lastSeenAt: Date | null; tokens: number }

export async function getTopMachines(_userId: string, _range: DateRange, _limit = 5): Promise<TopMachine[]> {
  return [];
}

export interface RecentSession {
  sessionId: string; sessionUuid: string;
  accountLabel: string; accountColor: string;
  projectName: string; model: string | null;
  turns: number; tokens: number; costUsd: number; startedAt: Date;
}

export async function getRecentSessions(_userId: string, limit = 10): Promise<RecentSession[]> {
  const sessions = await prisma.session.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
    include: { project: { include: { account: true } } },
  });
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const aggRows = await prisma.$queryRaw<
    { sessionId: string; tokens: number; costUsd: number; turns: number }[]
  >`
    SELECT e.sessionId,
           COALESCE(SUM(e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens), 0) as tokens,
           COALESCE(SUM(e.costUsd), 0) as costUsd,
           COUNT(DISTINCT t.id) as turns
    FROM UsageEvent e
    LEFT JOIN Turn t ON t.sessionId = e.sessionId
    WHERE e.sessionId IN (${Prisma.join(sessionIds)})
    GROUP BY e.sessionId
  `;
  const aggMap = new Map(aggRows.map((r) => [r.sessionId, { tokens: Number(r.tokens), costUsd: Number(r.costUsd), turns: Number(r.turns) }]));

  return sessions.map((s) => {
    const agg = aggMap.get(s.id) ?? { tokens: 0, costUsd: 0, turns: 0 };
    return {
      sessionId: s.id,
      sessionUuid: s.sessionUuid,
      accountLabel: s.project.account.label,
      accountColor: s.project.account.color,
      projectName: s.project.name,
      model: s.model,
      turns: agg.turns,
      tokens: agg.tokens,
      costUsd: agg.costUsd,
      startedAt: s.startedAt,
    };
  });
}

export interface FilterOption { value: string; label: string; color?: string }

export async function getFilterOptions(_userId: string): Promise<{
  accounts: FilterOption[]; machines: FilterOption[]; models: FilterOption[]; projects: FilterOption[];
}> {
  const [acct, projects, modelRows] = await Promise.all([
    prisma.account.findUnique({ where: { id: LOCAL_ACCOUNT_ID } }),
    prisma.project.findMany({ select: { id: true, name: true } }),
    prisma.$queryRaw<{ model: string }[]>`SELECT DISTINCT model FROM Session WHERE model IS NOT NULL ORDER BY model`,
  ]);
  return {
    accounts: acct ? [{ value: acct.id, label: acct.label, color: acct.color }] : [],
    machines: [],
    models: modelRows.map((r) => ({ value: r.model, label: r.model })),
    projects: projects.map((p) => ({ value: p.id, label: p.name })),
  };
}
