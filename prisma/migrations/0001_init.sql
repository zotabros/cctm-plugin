-- CCTM initial schema (sqlite). Authoritative for the worker runtime.
-- Mirrors prisma/schema.prisma. Apply via worker bootstrap migrator.

CREATE TABLE IF NOT EXISTS Account (
  id           TEXT PRIMARY KEY,
  claudeEmail  TEXT UNIQUE,
  label        TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#B4490B'
);

CREATE TABLE IF NOT EXISTS Project (
  id        TEXT PRIMARY KEY,
  accountId TEXT NOT NULL REFERENCES Account(id) ON DELETE CASCADE,
  cwdPath   TEXT NOT NULL,
  name      TEXT NOT NULL,
  UNIQUE(accountId, cwdPath)
);
CREATE INDEX IF NOT EXISTS idx_project_account ON Project(accountId);

CREATE TABLE IF NOT EXISTS Session (
  id          TEXT PRIMARY KEY,
  projectId   TEXT NOT NULL REFERENCES Project(id) ON DELETE CASCADE,
  sessionUuid TEXT NOT NULL UNIQUE,
  startedAt   TEXT NOT NULL,
  endedAt     TEXT,
  model       TEXT
);
CREATE INDEX IF NOT EXISTS idx_session_project ON Session(projectId);

CREATE TABLE IF NOT EXISTS UsageEvent (
  id                  TEXT PRIMARY KEY,
  sessionId           TEXT NOT NULL REFERENCES Session(id) ON DELETE CASCADE,
  ts                  TEXT NOT NULL,
  role                TEXT NOT NULL,
  model               TEXT NOT NULL,
  inputTokens         INTEGER NOT NULL DEFAULT 0,
  outputTokens        INTEGER NOT NULL DEFAULT 0,
  cacheCreationTokens INTEGER NOT NULL DEFAULT 0,
  cacheReadTokens     INTEGER NOT NULL DEFAULT 0,
  toolCallsJson       TEXT,
  costUsd             REAL NOT NULL DEFAULT 0,
  accountId           TEXT NOT NULL,
  UNIQUE(sessionId, ts, role)
);
CREATE INDEX IF NOT EXISTS idx_usage_session_ts ON UsageEvent(sessionId, ts);
CREATE INDEX IF NOT EXISTS idx_usage_account_ts ON UsageEvent(accountId, ts);

CREATE TABLE IF NOT EXISTS MachineInventory (
  id         TEXT PRIMARY KEY,
  capturedAt TEXT NOT NULL,
  hash       TEXT NOT NULL UNIQUE,
  payload    TEXT NOT NULL,
  createdAt  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inventory_captured ON MachineInventory(capturedAt);

CREATE TABLE IF NOT EXISTS AdvisorFinding (
  id         TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  ruleId     TEXT NOT NULL UNIQUE,
  severity   TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  payload    TEXT,
  detectedAt TEXT NOT NULL DEFAULT (datetime('now')),
  resolvedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_finding_category ON AdvisorFinding(category);
CREATE INDEX IF NOT EXISTS idx_finding_detected ON AdvisorFinding(detectedAt);

CREATE TABLE IF NOT EXISTS Turn (
  id                    TEXT PRIMARY KEY,
  sessionId             TEXT NOT NULL REFERENCES Session(id) ON DELETE CASCADE,
  ordinal               INTEGER NOT NULL,
  promptStartedAt       TEXT NOT NULL,
  promptEndedAt         TEXT,
  latencyMs             INTEGER,
  userPromptHash        TEXT NOT NULL,
  userPromptPreview     TEXT NOT NULL,
  totalInputTokens      INTEGER NOT NULL DEFAULT 0,
  totalOutputTokens     INTEGER NOT NULL DEFAULT 0,
  totalCacheReadTokens  INTEGER NOT NULL DEFAULT 0,
  totalCacheWriteTokens INTEGER NOT NULL DEFAULT 0,
  totalCostUsd          REAL NOT NULL DEFAULT 0,
  reconciledAt          TEXT,
  UNIQUE(sessionId, ordinal)
);
CREATE INDEX IF NOT EXISTS idx_turn_session ON Turn(sessionId, promptStartedAt);

CREATE TABLE IF NOT EXISTS ToolInvocation (
  id                     TEXT PRIMARY KEY,
  turnId                 TEXT NOT NULL REFERENCES Turn(id) ON DELETE CASCADE,
  toolUseId              TEXT NOT NULL UNIQUE,
  toolName               TEXT NOT NULL,
  mcpServer              TEXT,
  mcpToolName            TEXT,
  startedAt              TEXT NOT NULL,
  endedAt                TEXT,
  durationMs             INTEGER,
  success                INTEGER,
  errorPreview           TEXT,
  attributedInputTokens  INTEGER NOT NULL DEFAULT 0,
  attributedOutputTokens INTEGER NOT NULL DEFAULT 0,
  attributedCostUsd      REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tool_turn ON ToolInvocation(turnId);
CREATE INDEX IF NOT EXISTS idx_tool_name ON ToolInvocation(toolName);
CREATE INDEX IF NOT EXISTS idx_tool_mcp ON ToolInvocation(mcpServer);

CREATE TABLE IF NOT EXISTS SubagentSpan (
  id                     TEXT PRIMARY KEY,
  turnId                 TEXT NOT NULL REFERENCES Turn(id) ON DELETE CASCADE,
  agentId                TEXT NOT NULL,
  agentType              TEXT NOT NULL,
  startedAt              TEXT NOT NULL,
  endedAt                TEXT,
  attributedInputTokens  INTEGER NOT NULL DEFAULT 0,
  attributedOutputTokens INTEGER NOT NULL DEFAULT 0,
  attributedCostUsd      REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_subagent_turn ON SubagentSpan(turnId);
CREATE INDEX IF NOT EXISTS idx_subagent_type ON SubagentSpan(agentType);

CREATE TABLE IF NOT EXISTS SessionCursor (
  sessionId      TEXT PRIMARY KEY REFERENCES Session(id) ON DELETE CASCADE,
  transcriptPath TEXT NOT NULL,
  byteOffset     INTEGER NOT NULL DEFAULT 0,
  updatedAt      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS RawHookEvent (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT NOT NULL DEFAULT (datetime('now')),
  event     TEXT NOT NULL,
  payload   TEXT
);

CREATE TABLE IF NOT EXISTS _migrations (
  id        INTEGER PRIMARY KEY,
  appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
