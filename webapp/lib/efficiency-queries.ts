// Local-first stub. Type-correct empty results until sqlite re-implementation.

import { prisma } from "@/lib/db";
import type { DateRange } from "@/lib/range";
import type { UsageFilters } from "@/lib/queries";

export interface TreemapNode { name: string; parent: string; value: number; color?: string }

export async function getCostAllocation(
  _userId: string, _range: DateRange, _filters: UsageFilters
): Promise<TreemapNode[]> {
  return [];
}

export interface CacheHitPoint {
  day: string; cacheRead: number; input: number; cacheCreation: number; hitPct: number;
}

export async function getCacheHitTrend(
  _userId: string, _range: DateRange, _filters: UsageFilters
): Promise<CacheHitPoint[]> {
  return [];
}

export interface HistogramResult {
  bins: { label: string; lower: number; upper: number; count: number }[];
  p50: number; p90: number; p99: number; totalTurns: number;
}

const HIST_BUCKETS = [
  { label: "<1k",       lower: 0,      upper: 1_000 },
  { label: "1k–5k",     lower: 1_000,  upper: 5_000 },
  { label: "5k–20k",    lower: 5_000,  upper: 20_000 },
  { label: "20k–100k",  lower: 20_000, upper: 100_000 },
  { label: "100k+",     lower: 100_000, upper: Number.POSITIVE_INFINITY },
] as const;

export async function getTokensPerTurnHistogram(
  _userId: string, _range: DateRange, _filters: UsageFilters
): Promise<HistogramResult> {
  return {
    bins: HIST_BUCKETS.map((b) => ({ ...b, count: 0 })),
    p50: 0, p90: 0, p99: 0, totalTurns: 0,
  };
}

export interface SessionLengthStats {
  avgTurns: number; p50Turns: number; p90Turns: number; avgDurationMin: number; longTailSessionsCount: number;
}

export async function getSessionLengthStats(
  _userId: string, _range: DateRange, _filters: UsageFilters
): Promise<SessionLengthStats> {
  return { avgTurns: 0, p50Turns: 0, p90Turns: 0, avgDurationMin: 0, longTailSessionsCount: 0 };
}

export interface ToolBreakdownRow { tool: string; count: number; estTokens: number }

export async function getToolBreakdown(
  _userId: string, _range: DateRange, _filters: UsageFilters, _limit = 12
): Promise<ToolBreakdownRow[]> {
  return [];
}

export interface SessionRow {
  sessionId: string; sessionUuid: string; startedAt: Date;
  accountLabel: string; accountColor: string; machineLabel: string;
  projectName: string; model: string | null;
  turns: number; tokens: number; costUsd: number; durationSec: number;
}

export async function getSessionsList(
  _userId: string, _range: DateRange, _filters: UsageFilters,
  page = 1, pageSize = 50
): Promise<{ rows: SessionRow[]; total: number }> {
  const skip = (page - 1) * pageSize;
  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      skip, take: pageSize,
      orderBy: { startedAt: "desc" },
      include: { project: { include: { account: true } } },
    }),
    prisma.session.count(),
  ]);
  return {
    rows: sessions.map((s) => ({
      sessionId: s.id, sessionUuid: s.sessionUuid, startedAt: s.startedAt,
      accountLabel: s.project.account.label, accountColor: s.project.account.color,
      machineLabel: "local",
      projectName: s.project.name, model: s.model,
      turns: 0, tokens: 0, costUsd: 0,
      durationSec: s.endedAt ? Math.max(0, (+s.endedAt - +s.startedAt) / 1000) : 0,
    })),
    total,
  };
}

export interface ToolCall { name: string; inputBytes?: number; tokensApprox?: number }

export interface TurnRow {
  id: string; ts: Date; role: string; model: string;
  input: number; output: number; cacheCreation: number; cacheRead: number;
  totalTokens: number; costUsd: number; toolCalls: ToolCall[];
}

export interface SessionDetail {
  session: { id: string; uuid: string; startedAt: Date; endedAt: Date | null; model: string | null };
  account: { id: string; label: string; color: string };
  machine: { id: string; label: string };
  project: { id: string; name: string; cwdPath: string };
  turns: TurnRow[];
  aggregates: {
    totalTokens: number; totalCost: number; durationSec: number; cacheHitPct: number;
    breakdown: { input: number; cacheCreation: number; cacheRead: number; output: number };
    topTools: { tool: string; count: number }[];
  };
}

export async function getSessionDetail(
  sessionId: string, _userId: string
): Promise<SessionDetail | null> {
  const session = await prisma.session.findFirst({
    where: { id: sessionId },
    include: {
      project: { include: { account: true } },
      usageEvents: { orderBy: { ts: "asc" } },
    },
  });
  if (!session) return null;
  const turns: TurnRow[] = session.usageEvents.map((e) => {
    const total = e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens;
    let toolCalls: ToolCall[] = [];
    if (e.toolCallsJson) {
      try { toolCalls = JSON.parse(e.toolCallsJson) as ToolCall[]; } catch (_) {}
    }
    return {
      id: e.id, ts: e.ts, role: e.role, model: e.model,
      input: e.inputTokens, output: e.outputTokens,
      cacheCreation: e.cacheCreationTokens, cacheRead: e.cacheReadTokens,
      totalTokens: total, costUsd: e.costUsd ?? 0,
      toolCalls,
    };
  });
  const totalTokens = turns.reduce((a, t) => a + t.totalTokens, 0);
  const totalCost = turns.reduce((a, t) => a + t.costUsd, 0);
  const cacheRead = turns.reduce((a, t) => a + t.cacheRead, 0);
  const denom = turns.reduce((a, t) => a + t.cacheRead + t.input + t.cacheCreation, 0);
  return {
    session: {
      id: session.id, uuid: session.sessionUuid,
      startedAt: session.startedAt, endedAt: session.endedAt, model: session.model,
    },
    account: { id: session.project.account.id, label: session.project.account.label, color: session.project.account.color },
    machine: { id: "local", label: "local" },
    project: { id: session.project.id, name: session.project.name, cwdPath: session.project.cwdPath },
    turns,
    aggregates: {
      totalTokens, totalCost,
      durationSec: session.endedAt ? Math.max(0, (+session.endedAt - +session.startedAt) / 1000) : 0,
      cacheHitPct: denom === 0 ? 0 : (cacheRead / denom) * 100,
      breakdown: {
        input: turns.reduce((a, t) => a + t.input, 0),
        cacheCreation: turns.reduce((a, t) => a + t.cacheCreation, 0),
        cacheRead: turns.reduce((a, t) => a + t.cacheRead, 0),
        output: turns.reduce((a, t) => a + t.output, 0),
      },
      topTools: [],
    },
  };
}
