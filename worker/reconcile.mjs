// Stop reconciliation. Reads transcript from cursor, parses, inserts UsageEvent
// rows, runs attribution, advances cursor. Single-flight per session, debounced.
import { readFile, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { parseAnyLine, parseJsonlLine } from './parser.mjs';
import { advanceCursor, getCursor } from './cursor.mjs';
import { attributeTurn } from './attribution.mjs';
import { computeCost } from '../shared/pricing.mjs';

const DEBOUNCE_MS = 250;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 500;

const pending = new Map(); // sessionId -> timer

export function scheduleReconcile(state, sessionId) {
  const existing = pending.get(sessionId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    pending.delete(sessionId);
    runReconcile(state, sessionId).catch((e) => {
      try { state.logErr(`reconcile ${sessionId} ${e.message}`); } catch (_) {}
    });
  }, DEBOUNCE_MS);
  pending.set(sessionId, t);
}

const inflight = new Set();

async function runReconcile(state, sessionId) {
  if (inflight.has(sessionId)) {
    // Re-queue; another debounce will land.
    scheduleReconcile(state, sessionId);
    return;
  }
  inflight.add(sessionId);
  try {
    await reconcileOnce(state, sessionId);
  } finally {
    inflight.delete(sessionId);
  }
}

async function reconcileOnce(state, sessionId) {
  const { db } = state;
  const cursor = getCursor(db, sessionId);
  if (!cursor) return;

  let buf;
  try {
    const st = await stat(cursor.transcriptPath);
    if (st.size <= cursor.byteOffset) return;
    const fh = await readFile(cursor.transcriptPath);
    buf = fh.subarray(cursor.byteOffset);
  } catch (e) {
    return;
  }

  // Try parse with up to MAX_RETRIES backoffs if last line is incomplete.
  let text = buf.toString('utf8');
  let lines = text.split('\n');
  // Last entry if file does not end with newline is a partial — leave it unparsed.
  let trailingPartial = !text.endsWith('\n');
  let attempts = 0;
  while (trailingPartial && attempts < MAX_RETRIES) {
    await sleep(RETRY_BACKOFF_MS);
    try {
      const fh = await readFile(cursor.transcriptPath);
      buf = fh.subarray(cursor.byteOffset);
      text = buf.toString('utf8');
      lines = text.split('\n');
      trailingPartial = !text.endsWith('\n');
    } catch (_) {}
    attempts++;
  }

  // Determine the byte offset of the last fully terminated line.
  const lastNewline = text.lastIndexOf('\n');
  const consumedBytes = lastNewline >= 0 ? lastNewline + 1 : 0;
  if (consumedBytes <= 0) return;

  const parsedLines = lines.slice(0, lastNewline >= 0 ? -1 : 0);
  const sessionRow = db.prepare('SELECT id, sessionUuid, projectId FROM Session WHERE id = ?').get(sessionId);
  if (!sessionRow) return;
  const projectRow = db.prepare('SELECT cwdPath, accountId FROM Project WHERE id = ?').get(sessionRow.projectId);
  if (!projectRow) return;

  const ctx = { sessionUuid: sessionRow.sessionUuid, cwd: projectRow.cwdPath };
  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO UsageEvent
      (id, sessionId, ts, role, model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, toolCallsJson, costUsd, accountId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const allEntries = [];
  const insertTx = db.transaction(() => {
    for (const line of parsedLines) {
      const raw = parseAnyLine(line);
      if (raw) allEntries.push(raw);
      const ev = parseJsonlLine(line, ctx);
      if (!ev) continue;
      const cost = computeCost({
        model: ev.model,
        input: ev.inputTokens,
        output: ev.outputTokens,
        cacheCreation: ev.cacheCreationTokens,
        cacheRead: ev.cacheReadTokens,
      });
      insertEvent.run(
        randomUUID(), sessionId, ev.timestamp, ev.role, ev.model || 'unknown',
        ev.inputTokens, ev.outputTokens, ev.cacheCreationTokens, ev.cacheReadTokens,
        ev.toolCalls ? JSON.stringify(ev.toolCalls) : null,
        cost, projectRow.accountId,
      );
    }
  });
  insertTx();

  // Run attribution per open Turn (the most recent unreconciled Turn(s)).
  await runAttributionForOpenTurns(state, sessionId, allEntries);

  // Only advance cursor after attribution succeeds — prevents data loss if
  // attribution fails (cursor would skip entries that haven't been attributed).
  advanceCursor(db, sessionId, cursor.byteOffset + consumedBytes);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function chunkTurnEntries(allEntries) {
  // Slice the entries into per-turn chunks. A turn starts at a user message
  // that is not a tool_result and ends just before the next such user message.
  const turns = [];
  let cur = null;
  for (const e of allEntries) {
    const isUserPrompt = e?.type === 'user' && Array.isArray(e?.message?.content)
      ? !e.message.content.some((c) => c?.type === 'tool_result')
      : (e?.type === 'user' && typeof e?.message?.content === 'string');
    if (isUserPrompt) {
      if (cur) turns.push(cur);
      cur = [e];
    } else if (cur) {
      cur.push(e);
    }
  }
  if (cur) turns.push(cur);
  return turns;
}

async function runAttributionForOpenTurns(state, sessionId, allEntries) {
  const { db } = state;
  const turns = chunkTurnEntries(allEntries);
  if (!turns.length) return;

  const openTurns = db.prepare(`
    SELECT id, ordinal, userPromptHash FROM Turn WHERE sessionId = ? AND reconciledAt IS NULL ORDER BY ordinal ASC
  `).all(sessionId);

  for (const slice of turns) {
    const promptText = extractUserPromptText(slice[0]);
    if (!promptText) continue;
    const hash = createHash('sha256').update(promptText).digest('hex').slice(0, 16);
    const dbTurnIndex = openTurns.findIndex((t) => t.userPromptHash === hash);
    if (dbTurnIndex === -1) continue;
    const [dbTurn] = openTurns.splice(dbTurnIndex, 1);

    const { totals, perToolUseId } = attributeTurn(slice);
    const sessionRow = db.prepare('SELECT id, model FROM Session WHERE id = ?').get(sessionId);
    const model = sessionRow?.model || 'claude-sonnet-4-6';

    const turnCost = computeCost({
      model, input: totals.input, output: totals.output,
      cacheCreation: totals.cacheWrite, cacheRead: totals.cacheRead,
    });

    db.prepare(`
      UPDATE Turn SET
        totalInputTokens = ?, totalOutputTokens = ?,
        totalCacheReadTokens = ?, totalCacheWriteTokens = ?,
        totalCostUsd = ?, reconciledAt = datetime('now')
      WHERE id = ?
    `).run(totals.input, totals.output, totals.cacheRead, totals.cacheWrite, turnCost, dbTurn.id);

    const updTool = db.prepare(`
      UPDATE ToolInvocation SET
        attributedInputTokens = ?, attributedOutputTokens = ?, attributedCostUsd = ?
      WHERE toolUseId = ? AND turnId = ?
    `);
    for (const [toolUseId, v] of Object.entries(perToolUseId)) {
      const cost = computeCost({ model, input: v.input, output: v.output, cacheCreation: 0, cacheRead: 0 });
      updTool.run(v.input, v.output, cost, toolUseId, dbTurn.id);
    }

    // SubagentSpan rollups: sum ToolInvocation attributed tokens within each subagent's window.
    const spans = db.prepare('SELECT id, startedAt, endedAt FROM SubagentSpan WHERE turnId = ?').all(dbTurn.id);
    const updSpan = db.prepare(`
      UPDATE SubagentSpan SET attributedInputTokens = ?, attributedOutputTokens = ?, attributedCostUsd = ?
      WHERE id = ?
    `);
    for (const s of spans) {
      const tools = db.prepare(`
        SELECT attributedInputTokens, attributedOutputTokens FROM ToolInvocation
        WHERE turnId = ? AND startedAt >= ? AND (? IS NULL OR endedAt <= ?)
      `).all(dbTurn.id, s.startedAt, s.endedAt, s.endedAt);
      const sIn = tools.reduce((a, t) => a + t.attributedInputTokens, 0);
      const sOut = tools.reduce((a, t) => a + t.attributedOutputTokens, 0);
      const sCost = computeCost({ model, input: sIn, output: sOut, cacheCreation: 0, cacheRead: 0 });
      updSpan.run(sIn, sOut, sCost, s.id);
    }
  }
}

function extractUserPromptText(userEntry) {
  const c = userEntry?.message?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c.filter((x) => x?.type === 'text').map((x) => x.text || '').join('\n');
  }
  return '';
}
