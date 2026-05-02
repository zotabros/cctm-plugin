// Token attribution. Per plan §"Token attribution rule".
//
// Inputs: ordered list of transcript entries belonging to a single Turn,
// from the user prompt at index 0 up to (but not including) the next human
// prompt. Entries that are tool_result user messages stay in the array.
//
// Output: { totals, perToolUseId } where perToolUseId[id] = { input, output }
//
// Rules:
//   1. Per assistant message m with N>0 tool_use blocks:
//        - distribute m.usage.output_tokens equally over the N tool_use ids
//          (floor + carry remainder to first id).
//        - distribute m.usage.input_tokens (+ cache_read + cache_write) equally
//          over the tool_use ids referenced by tool_result blocks in the user
//          message immediately preceding m. If no such tool_results, input
//          tokens stay at Turn level only.
//      Pure-text assistant: tokens stay at Turn level only.
//   2. Byte-size override: if any single tool_result in that prior user message
//      occupies >= 80% of the total tool_result bytes, distribute by byte
//      weight instead of equal split.

function usage(m) {
  const u = m?.message?.usage ?? {};
  return {
    input: Number(u.input_tokens) || 0,
    output: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0,
    cacheWrite: Number(u.cache_creation_input_tokens) || 0,
  };
}

function toolUseIds(m) {
  const ids = [];
  for (const c of m?.message?.content ?? []) if (c?.type === 'tool_use' && c.id) ids.push(c.id);
  return ids;
}

function priorToolResultsByteMap(prevUserMsg) {
  // Returns { idA: bytes, idB: bytes }. Empty if none.
  const map = {};
  for (const c of prevUserMsg?.message?.content ?? []) {
    if (c?.type === 'tool_result' && c.tool_use_id) {
      let bytes;
      try { bytes = JSON.stringify(c.content ?? '').length; } catch { bytes = 0; }
      map[c.tool_use_id] = (map[c.tool_use_id] ?? 0) + (bytes || 0);
    }
  }
  return map;
}

function distributeEqual(total, ids) {
  const out = {};
  if (!ids.length || total <= 0) { for (const id of ids) out[id] = 0; return out; }
  const base = Math.floor(total / ids.length);
  let rem = total - base * ids.length;
  for (let i = 0; i < ids.length; i++) {
    out[ids[i]] = base + (i === 0 ? rem : 0);
    rem = i === 0 ? 0 : rem;
  }
  return out;
}

function distributeWeighted(total, weights) {
  // weights = { id: number }. Returns { id: int }, sum == total.
  const ids = Object.keys(weights);
  if (!ids.length || total <= 0) { const o = {}; for (const id of ids) o[id] = 0; return o; }
  const sum = ids.reduce((s, id) => s + weights[id], 0);
  if (sum <= 0) return distributeEqual(total, ids);
  const raw = ids.map((id) => ({ id, exact: (total * weights[id]) / sum }));
  const floored = raw.map((r) => ({ id: r.id, v: Math.floor(r.exact), frac: r.exact - Math.floor(r.exact) }));
  let rem = total - floored.reduce((s, r) => s + r.v, 0);
  floored.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < floored.length && rem > 0; i++, rem--) floored[i].v += 1;
  const out = {};
  for (const r of floored) out[r.id] = r.v;
  return out;
}

/** Compute attribution. `entries` is the chronological turn slice. */
export function attributeTurn(entries) {
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const perToolUseId = {};

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e?.type !== 'assistant' || !e?.message) continue;
    const u = usage(e);
    totals.input += u.input;
    totals.output += u.output;
    totals.cacheRead += u.cacheRead;
    totals.cacheWrite += u.cacheWrite;

    const ids = toolUseIds(e);

    // Output split equally across this message's tool_use ids (only if any).
    if (ids.length) {
      const outShare = distributeEqual(u.output, ids);
      for (const id of ids) {
        const slot = perToolUseId[id] ?? { input: 0, output: 0 };
        slot.output += outShare[id] ?? 0;
        perToolUseId[id] = slot;
      }
    }

    // Input attributed to ids appearing in tool_result of the immediately
    // prior user message — independent of whether this message has tool_uses.
    let inMap = {};
    let prev = entries[i - 1];
    if (prev?.type === 'user' && prev?.message) {
      const byteMap = priorToolResultsByteMap(prev);
      const presentIds = Object.keys(byteMap);
      if (presentIds.length) {
        const totalBytes = presentIds.reduce((s, id) => s + byteMap[id], 0);
        const dominant = presentIds.find((id) => byteMap[id] / Math.max(1, totalBytes) >= 0.8);
        const inputAndCache = u.input + u.cacheRead + u.cacheWrite;
        if (dominant && presentIds.length > 1) {
          inMap = distributeWeighted(inputAndCache, byteMap);
        } else {
          inMap = distributeEqual(inputAndCache, presentIds);
        }
      }
    }
    for (const [id, v] of Object.entries(inMap)) {
      const slot = perToolUseId[id] ?? { input: 0, output: 0 };
      slot.input += v;
      perToolUseId[id] = slot;
    }
  }

  return { totals, perToolUseId };
}
