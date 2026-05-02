// node:test runner. Exercises attribution rule on synthetic transcript slices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attributeTurn } from '../worker/attribution.mjs';

function userText(text) {
  return { type: 'user', message: { content: [{ type: 'text', text }] } };
}
function userToolResults(results) {
  return { type: 'user', message: { content: results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.content || '' })) } };
}
function assistant({ input = 0, output = 0, cacheRead = 0, cacheWrite = 0, toolUses = [], text = null } = {}) {
  const content = [];
  if (text) content.push({ type: 'text', text });
  for (const t of toolUses) content.push({ type: 'tool_use', id: t.id, name: t.name, input: t.input ?? {} });
  return {
    type: 'assistant',
    message: {
      usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheWrite },
      content,
    },
  };
}

test('pure-text turn: tokens stay at Turn level', () => {
  const slice = [
    userText('hello'),
    assistant({ input: 100, output: 50, text: 'hi' }),
  ];
  const r = attributeTurn(slice);
  assert.equal(r.totals.input, 100);
  assert.equal(r.totals.output, 50);
  assert.deepEqual(r.perToolUseId, {});
});

test('single-tool turn: output attributed; input from tool_result', () => {
  const slice = [
    userText('do thing'),
    assistant({ input: 200, output: 80, toolUses: [{ id: 'tu1', name: 'Read' }] }),
    userToolResults([{ id: 'tu1', content: 'file body' }]),
    assistant({ input: 300, output: 60, text: 'done' }),
  ];
  const r = attributeTurn(slice);
  assert.equal(r.totals.output, 140);
  assert.equal(r.perToolUseId.tu1.output, 80, 'tu1 gets all output of message #1');
  assert.equal(r.perToolUseId.tu1.input, 300, 'tu1 gets full input of message #2 since tool_result is single');
});

test('multi-tool turn: output split equally, input split by byte weights', () => {
  const slice = [
    userText('do parallel'),
    assistant({ input: 0, output: 100, toolUses: [
      { id: 'a', name: 'Read' }, { id: 'b', name: 'Glob' },
    ] }),
    userToolResults([
      { id: 'a', content: 'x'.repeat(100) },
      { id: 'b', content: 'y'.repeat(100) },
    ]),
    assistant({ input: 200, output: 0, text: 'k' }),
  ];
  const r = attributeTurn(slice);
  assert.equal(r.totals.output, 100);
  assert.equal(r.perToolUseId.a.output + r.perToolUseId.b.output, 100);
  assert.ok(Math.abs(r.perToolUseId.a.output - 50) <= 1);
  assert.equal(r.perToolUseId.a.input + r.perToolUseId.b.input, 200);
});

test('byte-size override: dominant tool >=80% takes most input', () => {
  const slice = [
    userText('mixed'),
    assistant({ input: 0, output: 50, toolUses: [
      { id: 'big', name: 'mcp__pencil__get_editor_state' }, { id: 'small', name: 'Read' },
    ] }),
    userToolResults([
      { id: 'big', content: 'z'.repeat(10000) },   // ~10KB
      { id: 'small', content: 'q'.repeat(50) },    // ~50B
    ]),
    assistant({ input: 1000, output: 0, text: 'ok' }),
  ];
  const r = attributeTurn(slice);
  assert.ok(r.perToolUseId.big.input > r.perToolUseId.small.input * 50,
    `big should dominate: big=${r.perToolUseId.big.input} small=${r.perToolUseId.small.input}`);
  assert.equal(r.perToolUseId.big.input + r.perToolUseId.small.input, 1000);
});

test('subagent slice (additive): tool_use IDs still attributed normally', () => {
  // Subagent-related entries are typically tool_use of name=Task or similar.
  // This test just guards that the rule doesn't break on a Task tool_use.
  const slice = [
    userText('investigate'),
    assistant({ input: 0, output: 30, toolUses: [{ id: 'task1', name: 'Task' }] }),
    userToolResults([{ id: 'task1', content: 'subagent done' }]),
    assistant({ input: 50, output: 20, text: 'summary' }),
  ];
  const r = attributeTurn(slice);
  assert.equal(r.perToolUseId.task1.output, 30);
  assert.equal(r.perToolUseId.task1.input, 50);
});
