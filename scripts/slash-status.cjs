#!/usr/bin/env node
'use strict';
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { call } = require('./slash-helper.cjs');
(async () => {
  try { execFileSync(process.execPath, [path.join(__dirname, 'ensure-worker.cjs')], { stdio: 'ignore' }); } catch (_) {}
  const r = await call('GET', '/api/status');
  if (r.status !== 200) { console.log(`cctm worker not reachable (${r.status})`); process.exit(0); }
  const s = r.body;
  console.log('CCTM status');
  console.log(`  DB: ${s.dbPath}`);
  console.log(`  Today: ${s.today.events} events  in=${s.today.input}  out=${s.today.output}  cost=$${(s.today.cost||0).toFixed(4)}`);
  if (s.lastTurn) console.log(`  Last turn: latency=${s.lastTurn.latencyMs}ms  cost=$${(s.lastTurn.totalCostUsd||0).toFixed(4)}`);
  if (s.topTools?.length) {
    console.log('  Top tools:');
    for (const t of s.topTools) console.log(`    ${t.toolName}: $${(t.cost||0).toFixed(4)}`);
  }
})();
