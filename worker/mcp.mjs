#!/usr/bin/env node
// CCTM MCP server (stdio). Read-only SQLite. Exposes 6 query tools.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openReader, openWriter, migrate, ensureLocalAccount, defaultDbPath } from './db.mjs';
import { PLUGIN_VERSION, PLUGIN_NAME } from '../shared/version.mjs';

const STAMP_FILE = join(homedir(), '.cctm', 'worker.stamp');

// Tolerant DB open — covers fresh install where MCP starts before worker has
// migrated the database. Polls briefly for the worker to bootstrap; if still
// missing, runs migrate ourselves so we can answer queries (with empty rows).
function openReaderTolerant() {
  const dbPath = defaultDbPath();
  const deadline = Date.now() + 3000;
  while (!existsSync(dbPath) && Date.now() < deadline) {
    const buf = new SharedArrayBuffer(4);
    const i32 = new Int32Array(buf);
    Atomics.wait(i32, 0, 0, 100);
  }
  if (!existsSync(dbPath)) {
    try {
      const w = openWriter(dbPath);
      migrate(w);
      ensureLocalAccount(w);
      w.close();
    } catch (e) {
      console.error(`[cctm-mcp] could not bootstrap DB: ${e.message}`);
    }
  }
  return openReader(dbPath);
}

const db = openReaderTolerant();

// Self-exit on plugin version drift. Claude Code respawns the stdio server
// with the new code; the user keeps working.
setInterval(() => {
  try {
    const s = JSON.parse(readFileSync(STAMP_FILE, 'utf8'));
    if (s.version && s.version !== PLUGIN_VERSION) {
      console.error(`[cctm-mcp] version drift (${PLUGIN_VERSION} → ${s.version}), exiting`);
      process.exit(0);
    }
  } catch (_) {}
}, 30_000).unref();

const TOOLS = [
  {
    name: 'getRecentTurns',
    description: 'List recent turns (id, prompt preview, latency, cost).',
    inputSchema: { type: 'object', properties: { limit: { type: 'number' }, sessionId: { type: 'string' } } },
  },
  {
    name: 'getTurn',
    description: 'Get one turn with its tool invocations and subagent spans.',
    inputSchema: { type: 'object', properties: { turnId: { type: 'string' } }, required: ['turnId'] },
  },
  {
    name: 'getToolBreakdown',
    description: 'Per-tool/MCP cost & latency breakdown for a turn.',
    inputSchema: { type: 'object', properties: { turnId: { type: 'string' } }, required: ['turnId'] },
  },
  {
    name: 'getMcpServerCosts',
    description: 'MCP server cost rollup over today|7d|30d.',
    inputSchema: { type: 'object', properties: { range: { type: 'string', enum: ['today', '7d', '30d'] } } },
  },
  {
    name: 'getSubagentCosts',
    description: 'Subagent cost rollup by agentType over a range.',
    inputSchema: { type: 'object', properties: { range: { type: 'string', enum: ['today', '7d', '30d'] } } },
  },
  {
    name: 'searchPrompts',
    description: 'Search turns by prompt preview substring or hash exact match.',
    inputSchema: { type: 'object', properties: { q: { type: 'string' }, limit: { type: 'number' } }, required: ['q'] },
  },
];

function rangeStart(range) {
  const d = new Date();
  if (range === '7d') d.setDate(d.getDate() - 7);
  else if (range === '30d') d.setDate(d.getDate() - 30);
  else d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function ok(rows) { return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }; }

const server = new Server({ name: PLUGIN_NAME, version: PLUGIN_VERSION }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  switch (name) {
    case 'getRecentTurns': {
      const limit = Math.min(Number(args.limit) || 20, 200);
      const where = args.sessionId ? 'WHERE sessionId = ?' : '';
      const stmt = `SELECT id, sessionId, ordinal, promptStartedAt, latencyMs, totalCostUsd, userPromptPreview FROM Turn ${where} ORDER BY promptStartedAt DESC LIMIT ?`;
      const rows = args.sessionId ? db.prepare(stmt).all(args.sessionId, limit) : db.prepare(stmt).all(limit);
      return ok(rows);
    }
    case 'getTurn': {
      const turn = db.prepare('SELECT * FROM Turn WHERE id = ?').get(args.turnId);
      if (!turn) return ok({ error: 'not found' });
      const tools = db.prepare('SELECT * FROM ToolInvocation WHERE turnId = ? ORDER BY startedAt').all(args.turnId);
      const subs = db.prepare('SELECT * FROM SubagentSpan WHERE turnId = ? ORDER BY startedAt').all(args.turnId);
      return ok({ turn, tools, subagents: subs });
    }
    case 'getToolBreakdown': {
      const rows = db.prepare(`
        SELECT toolName, mcpServer,
          COUNT(*) AS invocations,
          SUM(durationMs) AS totalMs,
          AVG(durationMs) AS avgMs,
          SUM(attributedCostUsd) AS cost
        FROM ToolInvocation WHERE turnId = ?
        GROUP BY toolName, mcpServer ORDER BY cost DESC
      `).all(args.turnId);
      return ok(rows);
    }
    case 'getMcpServerCosts': {
      const start = rangeStart(args.range || 'today');
      const rows = db.prepare(`
        SELECT mcpServer, COUNT(*) AS invocations, SUM(attributedCostUsd) AS cost, AVG(durationMs) AS avgMs
        FROM ToolInvocation WHERE startedAt >= ? AND mcpServer IS NOT NULL
        GROUP BY mcpServer ORDER BY cost DESC
      `).all(start);
      return ok(rows);
    }
    case 'getSubagentCosts': {
      const start = rangeStart(args.range || 'today');
      const rows = db.prepare(`
        SELECT agentType, COUNT(*) AS spans, SUM(attributedCostUsd) AS cost
        FROM SubagentSpan WHERE startedAt >= ?
        GROUP BY agentType ORDER BY cost DESC
      `).all(start);
      return ok(rows);
    }
    case 'searchPrompts': {
      const limit = Math.min(Number(args.limit) || 20, 100);
      const q = String(args.q || '').replace(/[%_\\]/g, '\\$&');
      const rows = db.prepare(`
        SELECT id, sessionId, ordinal, promptStartedAt, totalCostUsd, userPromptPreview
        FROM Turn WHERE userPromptPreview LIKE ? ESCAPE '\\' OR userPromptHash = ?
        ORDER BY promptStartedAt DESC LIMIT ?
      `).all(`%${q}%`, q, limit);
      return ok(rows);
    }
    default:
      return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
