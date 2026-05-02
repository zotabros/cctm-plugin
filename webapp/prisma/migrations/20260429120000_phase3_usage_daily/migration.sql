-- Materialized view for fast day-grain rollups by project / machine / model.
-- Refresh via /api/cron/refresh-usage-daily.

CREATE MATERIALIZED VIEW IF NOT EXISTS usage_daily AS
SELECT
  date_trunc('day', ue.ts)                       AS day,
  s."projectId"                                  AS project_id,
  p."accountId"                                  AS account_id,
  s."machineId"                                  AS machine_id,
  ue.model                                       AS model,
  SUM(ue."inputTokens")::bigint                  AS input_tokens,
  SUM(ue."outputTokens")::bigint                 AS output_tokens,
  SUM(ue."cacheCreationTokens")::bigint          AS cache_creation_tokens,
  SUM(ue."cacheReadTokens")::bigint              AS cache_read_tokens,
  SUM(ue."costUsd")                              AS cost_usd,
  COUNT(*)::bigint                               AS event_count
FROM "UsageEvent" ue
JOIN "Session" s ON s.id = ue."sessionId"
JOIN "Project" p ON p.id = s."projectId"
GROUP BY 1, 2, 3, 4, 5;

CREATE UNIQUE INDEX IF NOT EXISTS usage_daily_pk
  ON usage_daily(day, project_id, machine_id, model);

CREATE INDEX IF NOT EXISTS usage_daily_account_day
  ON usage_daily(account_id, day);
