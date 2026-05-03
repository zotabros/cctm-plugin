#!/usr/bin/env node
// CCTM worker. Single-writer SQLite + HTTP on 127.0.0.1.
// Endpoints:
//   GET  /healthz
//   POST /hook/:event
//   POST /backfill
//   POST /inventory/refresh
//   POST /webapp/start, /webapp/stop
//   GET  /api/status
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdirSync, writeFileSync, appendFileSync, existsSync, readFileSync, readdirSync, statSync, cpSync, unlinkSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openWriter, migrate, ensureLocalAccount, defaultDbPath } from './db.mjs';
import { setCursor, getCursor } from './cursor.mjs';
import { parseJsonlLine } from './parser.mjs';
import { computeCost } from '../shared/pricing.mjs';
import { PLUGIN_VERSION } from '../shared/version.mjs';
import { collectInventory } from './inventory.mjs';
import { scheduleReconcile } from './reconcile.mjs';

function safeNum(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = dirname(HERE);
const CCTM_DIR = join(homedir(), '.cctm');
const PORT_FILE = join(CCTM_DIR, 'worker.port');
const PID_FILE = join(CCTM_DIR, 'worker.pid');
const STAMP_FILE = join(CCTM_DIR, 'worker.stamp');
const ERR_LOG = join(CCTM_DIR, 'hook-errors.log');
const WEBAPP_PID_FILE = join(CCTM_DIR, 'webapp.pid');
const WEBAPP_BUILD_LOG = join(CCTM_DIR, 'webapp-build.log');
const WEBAPP_BUILD_LOCK = join(CCTM_DIR, 'webapp.build.lock');
const PORT_RANGE = [39636, 39646];
const DEFAULT_PORT = Number(process.env.CCTM_PORT) || 39636;

// Code hash — bumps whenever any of the worker source files change. Used by
// scripts/ensure-worker.cjs to detect that a running worker is from old code.
const CODE_HASH = (() => {
  const h = createHash('sha256');
  for (const f of ['index.mjs', 'db.mjs', 'mcp.mjs', 'reconcile.mjs', 'attribution.mjs', 'parser.mjs']) {
    try { h.update(readFileSync(join(HERE, f))); } catch (_) {}
  }
  return h.digest('hex').slice(0, 16);
})();

mkdirSync(CCTM_DIR, { recursive: true });
const db = openWriter();
migrate(db);
ensureLocalAccount(db);

const state = {
  db,
  logErr(msg) {
    try { appendFileSync(ERR_LOG, `${new Date().toISOString()} ${msg}\n`); } catch (_) {}
  },
};

const webappState = { proc: null, port: null };

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

function readBody(req) {
  return new Promise((resolve, reject) => {
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > MAX_BODY_BYTES) return reject(new Error('payload too large'));
    let size = 0;
    let chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { chunks = []; return reject(new Error('payload too large')); }
      chunks.push(c);
    });
    req.on('end', () => {
      const buf = Buffer.concat(chunks).toString('utf8');
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); } catch { resolve({ _raw: buf }); }
    });
    req.on('error', () => resolve({}));
  });
}

function send(res, status, body) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(payload);
}

const ROUTES = {
  'GET /healthz': (req, res) => send(res, 200, {
    ok: true,
    version: PLUGIN_VERSION,
    codeHash: CODE_HASH,
    pid: process.pid,
    port: state.port,
    startedAt: state.startedAt,
  }),
  'GET /api/status': (req, res) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const rows = db.prepare(`
      SELECT COALESCE(SUM(inputTokens),0) AS i, COALESCE(SUM(outputTokens),0) AS o,
             COALESCE(SUM(costUsd),0) AS c, COUNT(*) AS n
      FROM UsageEvent WHERE ts >= ?
    `).get(today.toISOString());
    const lastTurn = db.prepare(`
      SELECT latencyMs, totalCostUsd FROM Turn WHERE reconciledAt IS NOT NULL
      ORDER BY promptStartedAt DESC LIMIT 1
    `).get();
    const topTools = db.prepare(`
      SELECT toolName, SUM(attributedCostUsd) AS cost FROM ToolInvocation
      GROUP BY toolName ORDER BY cost DESC LIMIT 3
    `).all();
    send(res, 200, {
      today: { input: rows.i, output: rows.o, cost: rows.c, events: rows.n },
      lastTurn,
      topTools,
      dbPath: defaultDbPath(),
    });
  },
};

async function handle(req, res) {
  const url = new URL(req.url, `http://127.0.0.1`);
  const key = `${req.method} ${url.pathname}`;
  const exact = ROUTES[key];
  if (exact) return exact(req, res);

  // Pattern routes.
  const m = url.pathname.match(/^\/hook\/([A-Za-z]+)$/);
  if (m && req.method === 'POST') {
    const event = m[1];
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return send(res, 413, { ok: false, error: e.message });
    }
    try {
      handleHook(event, body);
      return send(res, 200, { ok: true });
    } catch (e) {
      state.logErr(`hook ${event} ${e.message}`);
      return send(res, 500, { ok: false, error: e.message });
    }
  }
  if (url.pathname === '/backfill' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const result = await runBackfill(body?.root);
      return send(res, 200, result);
    } catch (e) { return send(res, 500, { ok: false, error: e.message }); }
  }
  if (url.pathname === '/inventory/refresh' && req.method === 'POST') {
    try {
      const inv = await collectInventory();
      const hash = createHash('sha256').update(JSON.stringify(inv)).digest('hex').slice(0, 16);
      db.prepare(`INSERT OR IGNORE INTO MachineInventory (id, capturedAt, hash, payload) VALUES (?, ?, ?, ?)`)
        .run(randomUUID(), inv.capturedAt, hash, JSON.stringify(inv));
      return send(res, 200, { ok: true, hash });
    } catch (e) { return send(res, 500, { ok: false, error: e.message }); }
  }
  if (url.pathname === '/webapp/start' && req.method === 'POST') {
    const body = await readBody(req);
    return startWebapp(body, res);
  }
  if (url.pathname === '/webapp/stop' && req.method === 'POST') {
    return stopWebapp(res);
  }
  if (url.pathname === '/webapp/build-async' && req.method === 'POST') {
    return buildWebappAsync(res);
  }
  if (url.pathname === '/webapp/status' && req.method === 'GET') {
    const v = validateWebappBuild();
    return send(res, 200, { running: !!webappState.proc, port: webappState.port, validation: v });
  }
  send(res, 404, { error: 'not found' });
}

// ---------- Hooks ----------

function handleHook(event, payload) {
  if (process.env.CCTM_DEBUG === '1') {
    db.prepare(`INSERT INTO RawHookEvent (event, payload) VALUES (?, ?)`).run(event, JSON.stringify(payload));
  }
  switch (event) {
    case 'SessionStart':       return onSessionStart(payload);
    case 'UserPromptSubmit':   return onUserPromptSubmit(payload);
    case 'PreToolUse':         return onPreToolUse(payload);
    case 'PostToolUse':        return onPostToolUse(payload);
    case 'SubagentStart':      return onSubagentStart(payload);
    case 'SubagentStop':       return onSubagentStop(payload);
    case 'Stop':               return onStop(payload);
    case 'SessionEnd':         return onSessionEnd(payload);
    case 'PreCompact':         return onPreCompact(payload);
    default: return;
  }
}

function projectFor(cwd) {
  const accountId = 'local';
  const name = (cwd || '').split('/').filter(Boolean).pop() || 'unknown';
  const existing = db.prepare('SELECT id FROM Project WHERE accountId = ? AND cwdPath = ?').get(accountId, cwd);
  if (existing) return existing.id;
  const id = randomUUID();
  db.prepare('INSERT INTO Project (id, accountId, cwdPath, name) VALUES (?, ?, ?, ?)').run(id, accountId, cwd, name);
  return id;
}

function ensureSession(sessionUuid, cwd, transcriptPath, model, ts) {
  const existing = db.prepare('SELECT id, projectId FROM Session WHERE sessionUuid = ?').get(sessionUuid);
  if (existing) {
    if (transcriptPath) {
      db.prepare(`
        INSERT INTO SessionCursor (sessionId, transcriptPath, byteOffset, updatedAt)
        VALUES (?, ?, COALESCE((SELECT byteOffset FROM SessionCursor WHERE sessionId = ?), 0), datetime('now'))
        ON CONFLICT(sessionId) DO UPDATE SET transcriptPath = excluded.transcriptPath, updatedAt = datetime('now')
      `).run(existing.id, transcriptPath, existing.id);
    }
    return existing.id;
  }
  const projectId = projectFor(cwd || homedir());
  const id = randomUUID();
  db.prepare(`INSERT INTO Session (id, projectId, sessionUuid, startedAt, model) VALUES (?, ?, ?, ?, ?)`)
    .run(id, projectId, sessionUuid, ts || new Date().toISOString(), model || null);
  if (transcriptPath) setCursor(db, id, transcriptPath, 0);
  return id;
}

function onSessionStart(p) {
  const sid = p.session_id || p.sessionId;
  const cwd = p.cwd || p.workingDirectory || '';
  const transcriptPath = p.transcript_path || p.transcriptPath || '';
  if (!sid) return;
  ensureSession(sid, cwd, transcriptPath, p.model, p.timestamp);
}

function onUserPromptSubmit(p) {
  const sid = p.session_id || p.sessionId;
  if (!sid) return;
  const session = db.prepare('SELECT id FROM Session WHERE sessionUuid = ?').get(sid);
  if (!session) return;
  const promptText = String(p.prompt || p.user_prompt || '');
  const hash = createHash('sha256').update(promptText).digest('hex').slice(0, 16);
  const preview = promptText.slice(0, 280);
  const ord = (db.prepare('SELECT COALESCE(MAX(ordinal),0) AS n FROM Turn WHERE sessionId = ?').get(session.id).n || 0) + 1;
  db.prepare(`
    INSERT INTO Turn (id, sessionId, ordinal, promptStartedAt, userPromptHash, userPromptPreview)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), session.id, ord, p.timestamp || new Date().toISOString(), hash, preview);
}

function getOpenTurnId(sessionDbId) {
  const row = db.prepare(`
    SELECT id FROM Turn WHERE sessionId = ? AND promptEndedAt IS NULL
    ORDER BY ordinal DESC LIMIT 1
  `).get(sessionDbId);
  return row?.id || null;
}

function parseMcpName(toolName) {
  const m = /^mcp__([^_]+)__(.+)$/.exec(toolName || '');
  return m ? { mcpServer: m[1], mcpToolName: m[2] } : { mcpServer: null, mcpToolName: null };
}

function onPreToolUse(p) {
  const sid = p.session_id || p.sessionId;
  const session = db.prepare('SELECT id FROM Session WHERE sessionUuid = ?').get(sid);
  if (!session) return;
  const turnId = getOpenTurnId(session.id);
  if (!turnId) return;
  const toolUseId = p.tool_use_id || p.toolUseId || randomUUID();
  const toolName = String(p.tool_name || p.toolName || '');
  const { mcpServer, mcpToolName } = parseMcpName(toolName);
  db.prepare(`
    INSERT OR IGNORE INTO ToolInvocation (id, turnId, toolUseId, toolName, mcpServer, mcpToolName, startedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), turnId, toolUseId, toolName, mcpServer, mcpToolName, p.timestamp || new Date().toISOString());
}

function onPostToolUse(p) {
  const sid = p.session_id || p.sessionId;
  const toolUseId = p.tool_use_id || p.toolUseId;
  if (!toolUseId) return;
  const tool = db.prepare('SELECT id, startedAt FROM ToolInvocation WHERE toolUseId = ?').get(toolUseId);
  if (!tool) return;
  const endedAt = p.timestamp || new Date().toISOString();
  const dur = Math.max(0, new Date(endedAt).getTime() - new Date(tool.startedAt).getTime());
  const success = p.error || p.tool_error ? 0 : 1;
  const errPreview = (p.error || p.tool_error || '') ? String(p.error || p.tool_error || '').slice(0, 280) : null;
  db.prepare(`
    UPDATE ToolInvocation SET endedAt = ?, durationMs = ?, success = ?, errorPreview = ? WHERE id = ?
  `).run(endedAt, dur, success, errPreview, tool.id);
}

function onSubagentStart(p) {
  const sid = p.session_id || p.sessionId;
  const session = db.prepare('SELECT id FROM Session WHERE sessionUuid = ?').get(sid);
  if (!session) return;
  const turnId = getOpenTurnId(session.id);
  if (!turnId) return;
  db.prepare(`
    INSERT INTO SubagentSpan (id, turnId, agentId, agentType, startedAt) VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), turnId, p.agent_id || p.agentId || randomUUID(),
       p.agent_type || p.agentType || 'general', p.timestamp || new Date().toISOString());
}

function onSubagentStop(p) {
  const agentId = p.agent_id || p.agentId;
  if (!agentId) return;
  db.prepare(`
    UPDATE SubagentSpan SET endedAt = ?
    WHERE agentId = ? AND endedAt IS NULL
  `).run(p.timestamp || new Date().toISOString(), agentId);
}

function onStop(p) {
  const sid = p.session_id || p.sessionId;
  const session = db.prepare('SELECT id FROM Session WHERE sessionUuid = ?').get(sid);
  if (!session) return;
  const turnId = getOpenTurnId(session.id);
  if (turnId) {
    const ended = p.timestamp || new Date().toISOString();
    db.prepare(`
      UPDATE Turn SET promptEndedAt = ?,
        latencyMs = CAST((julianday(?) - julianday(promptStartedAt)) * 86400000 AS INTEGER)
      WHERE id = ?
    `).run(ended, ended, turnId);
  }
  scheduleReconcile(state, session.id);
}

function onSessionEnd(p) {
  const sid = p.session_id || p.sessionId;
  const session = db.prepare('SELECT id FROM Session WHERE sessionUuid = ?').get(sid);
  if (!session) return;
  db.prepare('UPDATE Session SET endedAt = ? WHERE id = ?').run(p.timestamp || new Date().toISOString(), session.id);
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) {}
}

function onPreCompact(p) {
  // Snapshot: nothing destructive needed. After compact, transcript hash will
  // change; we let the cursor rebase on next SessionStart.
}

// ---------- Backfill ----------

function isUserPrompt(entry) {
  if (entry?.type !== 'user') return false;
  const c = entry?.message?.content;
  if (typeof c === 'string') return true;
  if (Array.isArray(c)) return !c.some((x) => x?.type === 'tool_result');
  return false;
}

async function runBackfill(rootPath) {
  const root = rootPath || join(homedir(), '.claude', 'projects');
  let files = [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const proj = join(root, e.name);
      const sub = await readdir(proj).catch(() => []);
      for (const f of sub) if (f.endsWith('.jsonl')) files.push(join(proj, f));
    }
  } catch (e) {
    return { ok: false, error: `cannot read ${root}: ${e.message}` };
  }

  let inserted = 0;
  let turnsCreated = 0;
  let toolsCreated = 0;
  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO UsageEvent
      (id, sessionId, ts, role, model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, toolCallsJson, costUsd, accountId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const file of files) {
    try {
      const text = await readFile(file, 'utf8');
      const lines = text.split('\n');
      const sessionUuid = file.split('/').pop().replace(/\.jsonl$/, '');
      let cwd = null;
      for (const line of lines) {
        if (!line) continue;
        try { const j = JSON.parse(line); if (j.cwd) { cwd = j.cwd; break; } } catch (_) {}
      }
      if (!cwd) continue;
      const sessionId = ensureSession(sessionUuid, cwd, file, null, null);
      const acct = db.prepare('SELECT accountId FROM Project p JOIN Session s ON s.projectId = p.id WHERE s.id = ?').get(sessionId);
      const accountId = acct?.accountId || 'local';
      const ctx = { sessionUuid, cwd };

      const insertTurn = db.prepare(`
        INSERT OR IGNORE INTO Turn (id, sessionId, ordinal, promptStartedAt, userPromptHash, userPromptPreview)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const insertTool = db.prepare(`
        INSERT OR IGNORE INTO ToolInvocation (id, turnId, toolUseId, toolName, mcpServer, mcpToolName, startedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const parseMcp = (name) => {
        const m = /^mcp__([^_]+)__(.+)$/.exec(name || '');
        return m ? { mcpServer: m[1], mcpToolName: m[2] } : { mcpServer: null, mcpToolName: null };
      };

      const parsed = [];
      for (const line of lines) {
        if (!line) continue;
        try { parsed.push(JSON.parse(line)); } catch (_) {}
      }

      const tx = db.transaction(() => {
        let ordinal = 0;
        let currentTurnId = null;

        for (const entry of parsed) {
          // User prompt → create Turn
          if (isUserPrompt(entry)) {
            ordinal++;
            const promptText = typeof entry.message.content === 'string'
              ? entry.message.content
              : entry.message.content.filter((x) => x?.type === 'text').map((x) => x.text || '').join('\n');
            const hash = createHash('sha256').update(promptText).digest('hex').slice(0, 16);
            const preview = promptText.slice(0, 280);
            const turnId = randomUUID();
            insertTurn.run(turnId, sessionId, ordinal, entry.timestamp || new Date().toISOString(), hash, preview);
            if (insertTurn.changes) turnsCreated++;
            currentTurnId = turnId;
            continue;
          }

          // Assistant message → UsageEvent + ToolInvocation
          if (entry.type !== 'assistant' || !entry.message) continue;
          const usage = entry.message.usage ?? {};
          const model = entry.message.model;
          const inputTokens = safeNum(usage.input_tokens);
          const outputTokens = safeNum(usage.output_tokens);
          const cacheCreationTokens = safeNum(usage.cache_creation_input_tokens);
          const cacheReadTokens = safeNum(usage.cache_read_input_tokens);
          const toolCalls = Array.isArray(entry.message.content)
            ? entry.message.content.filter((b) => b?.type === 'tool_use')
            : [];
          const toolCallsJson = toolCalls.length ? JSON.stringify(toolCalls.map((t) => ({ name: t.name, inputBytes: JSON.stringify(t.input ?? null).length, toolUseId: t.id }))) : null;
          const cost = computeCost({ model, input: inputTokens, output: outputTokens, cacheCreation: cacheCreationTokens, cacheRead: cacheReadTokens });

          const r = insertEvent.run(randomUUID(), sessionId, entry.timestamp, 'assistant', model || 'unknown',
            inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, toolCallsJson, cost, accountId);
          if (r.changes) inserted++;

          // ToolInvocation records
          if (currentTurnId && toolCalls.length) {
            for (const tc of toolCalls) {
              const { mcpServer, mcpToolName } = parseMcp(tc.name);
              insertTool.run(randomUUID(), currentTurnId, tc.id || randomUUID(), tc.name, mcpServer, mcpToolName, entry.timestamp || new Date().toISOString());
              if (insertTool.changes) toolsCreated++;
            }
          }
        }
      });
      tx();
    } catch (e) {
      state.logErr(`backfill ${file} ${e.message}`);
    }
  }

  // Run attribution for all sessions that have open turns.
  const openSessions = db.prepare(`
    SELECT DISTINCT sessionId FROM Turn WHERE reconciledAt IS NULL
  `).all();
  for (const { sessionId } of openSessions) {
    try {
      const { attributeTurn } = await import('./attribution.mjs');
      const { parseAnyLine } = await import('./parser.mjs');
      const turns = db.prepare(`SELECT id, userPromptHash FROM Turn WHERE sessionId = ? AND reconciledAt IS NULL`).all(sessionId);
      const cursor = getCursor(db, sessionId);
      if (!cursor) continue;
      const fh = await readFile(cursor.transcriptPath).catch(() => null);
      if (!fh) continue;
      const allEntries = fh.toString('utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const turnChunks = [];
      let cur = null;
      for (const e of allEntries) {
        if (isUserPrompt(e)) { if (cur) turnChunks.push(cur); cur = [e]; }
        else if (cur) cur.push(e);
      }
      if (cur) turnChunks.push(cur);

      for (const chunk of turnChunks) {
        const promptText = typeof chunk[0].message.content === 'string'
          ? chunk[0].message.content
          : chunk[0].message.content.filter((x) => x?.type === 'text').map((x) => x.text || '').join('\n');
        const hash = createHash('sha256').update(promptText).digest('hex').slice(0, 16);
        const dbTurnIndex = turns.findIndex((t) => t.userPromptHash === hash);
        if (dbTurnIndex === -1) continue;
        const [dbTurn] = turns.splice(dbTurnIndex, 1);

        const { totals, perToolUseId } = attributeTurn(chunk);
        const sessionRow = db.prepare('SELECT model FROM Session WHERE id = ?').get(sessionId);
        const model = sessionRow?.model || 'claude-sonnet-4-6';
        const turnCost = computeCost({ model, input: totals.input, output: totals.output, cacheCreation: totals.cacheWrite, cacheRead: totals.cacheRead });

        db.prepare(`UPDATE Turn SET totalInputTokens = ?, totalOutputTokens = ?, totalCacheReadTokens = ?, totalCacheWriteTokens = ?, totalCostUsd = ?, reconciledAt = datetime('now') WHERE id = ?`)
          .run(totals.input, totals.output, totals.cacheRead, totals.cacheWrite, turnCost, dbTurn.id);

        const updTool = db.prepare(`UPDATE ToolInvocation SET attributedInputTokens = ?, attributedOutputTokens = ?, attributedCostUsd = ? WHERE toolUseId = ? AND turnId = ?`);
        for (const [toolUseId, v] of Object.entries(perToolUseId)) {
          const tc = computeCost({ model, input: v.input, output: v.output, cacheCreation: 0, cacheRead: 0 });
          updTool.run(v.input, v.output, tc, toolUseId, dbTurn.id);
        }
      }
    } catch (e) {
      state.logErr(`backfill-attribution ${sessionId} ${e.message}`);
    }
  }

  return { ok: true, files: files.length, inserted, turns: turnsCreated, tools: toolsCreated };
}

// ---------- Webapp supervisor ----------

function processAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (_) { return false; }
}

function killProcess(pid) {
  if (!pid || !processAlive(pid)) return;
  try { process.kill(pid, 'SIGTERM'); } catch (_) {}
  setTimeout(() => {
    if (processAlive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch (_) {} }
  }, 500).unref();
}

function stopWebappProcess() {
  if (webappState.proc) killProcess(webappState.proc.pid);
  try { killProcess(Number(readFileSync(WEBAPP_PID_FILE, 'utf8').trim())); } catch (_) {}
  try { unlinkSync(WEBAPP_PID_FILE); } catch (_) {}
  webappState.proc = null;
  webappState.port = null;
}

function findWebappEntryPath() {
  const candidates = [
    join(PLUGIN_ROOT, 'webapp', '.next', 'standalone', 'webapp', 'server.js'),
    join(PLUGIN_ROOT, 'webapp', '.next', 'standalone', 'server.js'),
  ];
  return candidates.find((p) => existsSync(p));
}

const WEBAPP_SRC_ROOTS = ['app', 'components', 'lib', 'prisma', 'public', 'styles'];
const WEBAPP_SRC_FILES = ['package.json', 'next.config.ts', 'next.config.mjs', 'tailwind.config.ts', 'postcss.config.mjs'];

function collectWebappSources() {
  const root = join(PLUGIN_ROOT, 'webapp');
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.push(p);
    }
  };
  for (const d of WEBAPP_SRC_ROOTS) walk(join(root, d));
  for (const f of WEBAPP_SRC_FILES) {
    const p = join(root, f);
    if (existsSync(p)) out.push(p);
  }
  out.sort();
  return out;
}

function webappBuildStamp() {
  const files = collectWebappSources();
  const h = createHash('sha256');
  for (const f of files) {
    h.update(f.slice(PLUGIN_ROOT.length));
    try { h.update(readFileSync(f)); } catch (_) {}
  }
  return { version: PLUGIN_VERSION, sourceHash: h.digest('hex').slice(0, 16) };
}

function validateWebappBuild() {
  const entry = findWebappEntryPath();
  if (!entry) return { ok: false, reason: 'missing' };
  const stampPath = join(dirname(entry), '.cctm-build-stamp');
  let stamp;
  try { stamp = JSON.parse(readFileSync(stampPath, 'utf8')); }
  catch { return { ok: false, reason: 'unstamped', entry }; }
  const want = webappBuildStamp();
  if (stamp.version !== want.version || stamp.sourceHash !== want.sourceHash) {
    return { ok: false, reason: 'drift', entry, want, have: stamp };
  }
  return { ok: true, entry };
}

function writeWebappBuildStamp() {
  const entry = findWebappEntryPath();
  if (!entry) return;
  const want = webappBuildStamp();
  try {
    writeFileSync(join(dirname(entry), '.cctm-build-stamp'),
      JSON.stringify({ ...want, builtAt: new Date().toISOString() }));
  } catch (_) {}
}

function pmAvailable(pm) {
  try {
    const r = spawnSync(pm, ['--version'], { encoding: 'utf8' });
    return r.status === 0;
  } catch (_) { return false; }
}

function buildWebapp() {
  const cwd = join(PLUGIN_ROOT, 'webapp');
  const logHeader = `\n[${new Date().toISOString()}] Building CCTM dashboard v=${PLUGIN_VERSION}\n`;
  try { appendFileSync(WEBAPP_BUILD_LOG, logHeader); } catch (_) {}
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
  const preferPnpm = existsSync(join(cwd, 'pnpm-lock.yaml'));
  let runner;
  if (preferPnpm && pmAvailable('pnpm')) {
    runner = ['pnpm', ['install', '--frozen-lockfile'], ['build']];
  } else if (pmAvailable('npm')) {
    runner = ['npm', ['install'], ['run', 'build']];
  } else if (pmAvailable('pnpm')) {
    runner = ['pnpm', ['install'], ['build']];
  } else {
    return { ok: false, error: 'No package manager found. Install npm or pnpm to build the dashboard.' };
  }
  for (const args of [runner[1], runner[2]]) {
    const r = spawnSync(runner[0], args, { cwd, env, encoding: 'utf8', timeout: 10 * 60 * 1000 });
    try {
      appendFileSync(WEBAPP_BUILD_LOG, `$ ${runner[0]} ${args.join(' ')}\n${r.stdout || ''}${r.stderr || ''}`);
    } catch (_) {}
    if (r.error || r.status !== 0) {
      const msg = r.error?.message || `exit ${r.status}`;
      return { ok: false, error: `${runner[0]} ${args.join(' ')} failed: ${msg}` };
    }
  }
  writeWebappBuildStamp();
  return { ok: true };
}

function startWebapp(opts, res) {
  const validation = validateWebappBuild();
  if (webappState.proc && validation.ok) {
    return send(res, 200, { ok: true, port: webappState.port, alreadyRunning: true });
  }
  // Drift or missing build → kill any running webapp from old code first.
  if (webappState.proc) stopWebappProcess();
  const port = Number(opts?.port) || Number(process.env.CCTM_WEBAPP_PORT) || 3636;
  try { killProcess(Number(readFileSync(WEBAPP_PID_FILE, 'utf8').trim())); } catch (_) {}

  if (!validation.ok) {
    state.logErr(`webapp ${validation.reason} — rebuilding`);
    const built = buildWebapp();
    if (!built.ok) {
      return send(res, 500, { ok: false, error: `webapp build failed. See ${WEBAPP_BUILD_LOG}. ${built.error}` });
    }
  }
  const standaloneEntry = findWebappEntryPath();
  if (!standaloneEntry) {
    return send(res, 500, { ok: false, error: `webapp build completed but standalone server was not found. See ${WEBAPP_BUILD_LOG}.` });
  }
  // Copy static + public dirs into standalone (Next.js standalone doesn't include them).
  const standaloneDir = dirname(standaloneEntry);
  const buildStatic = join(PLUGIN_ROOT, 'webapp', '.next', 'static');
  const destStatic = join(standaloneDir, '.next', 'static');
  const buildPublic = join(PLUGIN_ROOT, 'webapp', 'public');
  const destPublic = join(standaloneDir, 'public');
  try { if (existsSync(buildStatic)) cpSync(buildStatic, destStatic, { recursive: true }); } catch (_) {}
  try { if (existsSync(buildPublic)) cpSync(buildPublic, destPublic, { recursive: true }); } catch (_) {}
  const child = spawn(process.execPath, [standaloneEntry], {
    env: { ...process.env, PORT: String(port), CCTM_DB_PATH: defaultDbPath(), CCTM_DB_URL: `file:${defaultDbPath()}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  webappState.proc = child;
  webappState.port = port;
  try { writeFileSync(WEBAPP_PID_FILE, String(child.pid)); } catch (_) {}
  child.on('exit', () => {
    webappState.proc = null;
    webappState.port = null;
    try { unlinkSync(WEBAPP_PID_FILE); } catch (_) {}
  });
  send(res, 200, { ok: true, port });
}

function stopWebapp(res) {
  stopWebappProcess();
  send(res, 200, { ok: true });
}

let webappBuilding = false;

function buildWebappAsync(res) {
  const v = validateWebappBuild();
  if (v.ok) return send(res, 200, { ok: true, building: false, reason: 'in-sync' });
  if (webappBuilding) return send(res, 200, { ok: true, building: true, reason: 'already-running' });

  // Stale lock file? (>15 min old → assume crashed previous build)
  try {
    const st = statSync(WEBAPP_BUILD_LOCK);
    if (Date.now() - st.mtimeMs < 15 * 60 * 1000) {
      return send(res, 200, { ok: true, building: true, reason: 'lock-held' });
    }
    try { unlinkSync(WEBAPP_BUILD_LOCK); } catch (_) {}
  } catch (_) {}

  try { writeFileSync(WEBAPP_BUILD_LOCK, String(process.pid)); } catch (_) {}
  webappBuilding = true;
  send(res, 200, { ok: true, building: true, reason: v.reason });

  // Run synchronously (we've already responded). buildWebapp uses spawnSync but
  // we're inside a request handler that's already returned, so the event loop
  // is unblocked from the client's perspective.
  setImmediate(() => {
    try {
      const result = buildWebapp();
      state.logErr(`webapp build-async ${result.ok ? 'ok' : 'failed: ' + result.error}`);
    } catch (e) {
      state.logErr(`webapp build-async crash ${e.message}`);
    } finally {
      webappBuilding = false;
      try { unlinkSync(WEBAPP_BUILD_LOCK); } catch (_) {}
    }
  });
}

// ---------- Listen with port scan ----------

function listen(port) {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => { state.logErr(`handler ${e.message}`); try { send(res, 500, { error: e.message }); } catch (_) {} });
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && port < PORT_RANGE[1]) return listen(port + 1);
    state.logErr(`listen ${e.message}`); process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    state.port = port;
    state.startedAt = new Date().toISOString();
    try { writeFileSync(PORT_FILE, String(port)); } catch (_) {}
    try { writeFileSync(PID_FILE, String(process.pid)); } catch (_) {}
    try {
      writeFileSync(STAMP_FILE, JSON.stringify({
        version: PLUGIN_VERSION,
        codeHash: CODE_HASH,
        pid: process.pid,
        port,
        startedAt: state.startedAt,
      }));
    } catch (_) {}
    state.logErr(`worker listening 127.0.0.1:${port} pid=${process.pid} v=${PLUGIN_VERSION} hash=${CODE_HASH}`);
  });
}

listen(DEFAULT_PORT);

process.on('uncaughtException', (e) => {
  state.logErr(`uncaught ${e?.stack || e}`);
  process.exit(1); // ensure-worker.cjs will restart via double-fork
});
process.on('unhandledRejection', (e) => state.logErr(`unhandled ${e}`));
