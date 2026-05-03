#!/usr/bin/env node
'use strict';
// Bump version across all manifests in lockstep.
// Usage: node scripts/bump-version.cjs <new-version>
//   or:  node scripts/bump-version.cjs patch|minor|major

const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');

// (path, json-pointer-style update fn). Order matters only for reporting.
const TARGETS = [
  { file: '.claude-plugin/plugin.json',      set: (j, v) => { j.version = v; } },
  { file: '.claude-plugin/marketplace.json', set: (j, v) => { j.metadata.version = v; } },
  { file: 'marketplace.json',                set: (j, v) => { j.version = v; } },
  { file: 'package.json',                    set: (j, v) => { j.version = v; } },
  { file: 'webapp/package.json',             set: (j, v) => { j.version = v; } },
];

function readJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}

function writeJson(rel, data) {
  // Preserve trailing newline; 2-space indent matches existing files.
  writeFileSync(join(ROOT, rel), JSON.stringify(data, null, 2) + '\n');
}

function bump(current, kind) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!m) throw new Error(`Cannot parse current version "${current}"`);
  let [, maj, min, pat] = m.map(Number);
  if (kind === 'major') { maj++; min = 0; pat = 0; }
  else if (kind === 'minor') { min++; pat = 0; }
  else if (kind === 'patch') { pat++; }
  else throw new Error(`Unknown bump kind: ${kind}`);
  return `${maj}.${min}.${pat}`;
}

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: bump-version.cjs <x.y.z|patch|minor|major>');
  process.exit(1);
}

const current = readJson('.claude-plugin/plugin.json').version;
const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg : bump(current, arg);

if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`Invalid version: ${next}`);
  process.exit(1);
}

console.log(`${current} → ${next}`);
for (const t of TARGETS) {
  const j = readJson(t.file);
  t.set(j, next);
  writeJson(t.file, j);
  console.log(`  ✓ ${t.file}`);
}
console.log(`\nNext: git add -A && git commit -m "chore: v${next}" && git tag v${next} && git push origin main && git push origin v${next}`);
