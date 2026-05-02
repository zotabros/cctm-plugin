// Local-first stub implementations. Returns shape-correct empty/zero values so
// existing dashboard pages compile and render empty states. Real sqlite-backed
// aggregations are tracked as deferred work (see plan §"Migration phases" Phase 6).

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
  // Lightweight totals via Prisma aggregate against local SQLite.
  const events = await prisma.usageEvent.findMany({
    where: { ts: { gte: range.from, lt: range.to } },
    select: {
      inputTokens: true, outputTokens: true,
      cacheCreationTokens: true, cacheReadTokens: true,
      costUsd: true, sessionId: true, ts: true,
    },
  });
  const totalTokens = events.reduce(
    (a, e) => a + e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens, 0);
  const totalCost = events.reduce((a, e) => a + (e.costUsd ?? 0), 0);
  const sessions = new Set(events.map((e) => e.sessionId)).size;
  const cacheRead = events.reduce((a, e) => a + e.cacheReadTokens, 0);
  const denom = events.reduce((a, e) => a + e.cacheReadTokens + e.inputTokens + e.cacheCreationTokens, 0);
  const cacheHitPct = denom === 0 ? 0 : (cacheRead / denom) * 100;

  // 30-day sparkline.
  const since = new Date(); since.setDate(since.getDate() - 30); since.setHours(0, 0, 0, 0);
  const sparkRows = await prisma.usageEvent.findMany({
    where: { ts: { gte: since } },
    select: { ts: true, inputTokens: true, outputTokens: true, cacheCreationTokens: true, cacheReadTokens: true },
  });
  const byDay = new Map<string, number>();
  for (const r of sparkRows) {
    const d = r.ts.toISOString().slice(0, 10);
    const t = r.inputTokens + r.outputTokens + r.cacheCreationTokens + r.cacheReadTokens;
    byDay.set(d, (byDay.get(d) ?? 0) + t);
  }
  const sparkline30d = Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, tokens]) => ({ date, tokens }));

  return {
    totalTokens, totalCost, sessions, cacheHitPct,
    deltaTokensPct: 0, deltaCostPct: 0, deltaSessions: 0, deltaCacheHitPp: 0,
    sparkline30d,
  };
}

export interface UsageBucket { ts: string; [seriesKey: string]: number | string }
export interface UsageSeries { key: string; label: string; color: string }
export interface UsageOverTimeResult { buckets: UsageBucket[]; series: UsageSeries[] }

export async function getUsageOverTime(
  _userId: string,
  _range: DateRange,
  _groupBy: GroupBy,
  _filters: UsageFilters,
  _stackBy: StackBy
): Promise<UsageOverTimeResult> {
  return { buckets: [], series: [] };
}

export interface TopAccount {
  accountId: string; label: string; color: string; tokens: number; pctOfTotal: number;
}

export async function getTopAccounts(_userId: string, _range: DateRange, _limit = 5): Promise<TopAccount[]> {
  const acct = await prisma.account.findUnique({ where: { id: LOCAL_ACCOUNT_ID } });
  if (!acct) return [];
  return [{ accountId: acct.id, label: acct.label, color: acct.color || ACCOUNT_COLORS[0], tokens: 0, pctOfTotal: 100 }];
}

export interface TopProject {
  projectId: string; name: string; accountLabel: string; accountColor: string; tokens: number; cost: number;
}

export async function getTopProjects(_userId: string, _range: DateRange, _limit = 10): Promise<TopProject[]> {
  return [];
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
  return sessions.map((s) => ({
    sessionId: s.id,
    sessionUuid: s.sessionUuid,
    accountLabel: s.project.account.label,
    accountColor: s.project.account.color,
    projectName: s.project.name,
    model: s.model,
    turns: 0,
    tokens: 0,
    costUsd: 0,
    startedAt: s.startedAt,
  }));
}

export interface FilterOption { value: string; label: string; color?: string }

export async function getFilterOptions(_userId: string): Promise<{
  accounts: FilterOption[]; machines: FilterOption[]; models: FilterOption[]; projects: FilterOption[];
}> {
  const acct = await prisma.account.findUnique({ where: { id: LOCAL_ACCOUNT_ID } });
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  return {
    accounts: acct ? [{ value: acct.id, label: acct.label, color: acct.color }] : [],
    machines: [],
    models: [],
    projects: projects.map((p) => ({ value: p.id, label: p.name })),
  };
}
