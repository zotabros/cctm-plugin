// Pure-ESM port of cctm-agent/src/parser.ts. JSONL transcript line parser.

export function decodeCwd(encoded) {
  if (encoded.startsWith('-')) return '/' + encoded.slice(1).replace(/-/g, '/');
  return encoded.replace(/-/g, '/');
}

function safeNum(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function extractToolCalls(content) {
  if (!Array.isArray(content)) return undefined;
  const tools = [];
  for (const item of content) {
    if (item?.type === 'tool_use' && typeof item.name === 'string') {
      let bytes;
      try { bytes = JSON.stringify(item.input ?? null).length; } catch (_) {}
      tools.push({ name: item.name, inputBytes: bytes, toolUseId: item.id });
    }
  }
  return tools.length ? tools : undefined;
}

/** Parse one JSONL line. Returns null for non-assistant or malformed lines. */
export function parseJsonlLine(line, ctx) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let entry;
  try { entry = JSON.parse(trimmed); } catch { return null; }
  if (entry.type !== 'assistant') return null;
  if (!entry.timestamp || !entry.message) return null;

  const usage = entry.message.usage ?? {};
  const cwd = entry.cwd ?? ctx.cwd;
  const projectName = cwd.split('/').filter(Boolean).pop();

  return {
    sessionUuid: ctx.sessionUuid,
    cwd,
    projectName,
    timestamp: entry.timestamp,
    role: 'assistant',
    model: entry.message.model,
    inputTokens: safeNum(usage.input_tokens),
    outputTokens: safeNum(usage.output_tokens),
    cacheCreationTokens: safeNum(usage.cache_creation_input_tokens),
    cacheReadTokens: safeNum(usage.cache_read_input_tokens),
    toolCalls: extractToolCalls(entry.message.content),
    claudeUserEmail: ctx.claudeUserEmail,
    // Raw bits used by attribution.
    parentUuid: entry.parentUuid,
    uuid: entry.uuid,
    rawContent: entry.message.content,
    rawUsage: usage,
  };
}

/** Parse any line (assistant or user) for attribution walks. */
export function parseAnyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}
