#!/usr/bin/env node
// CCTM hook dispatcher. Reads stdin (Claude Code hook payload JSON),
// POSTs to local worker, fail-silent within 750ms. Never blocks Claude.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CCTM_DIR = path.join(os.homedir(), '.cctm');
const ERR_LOG = path.join(CCTM_DIR, 'hook-errors.log');
const PORT_FILE = path.join(CCTM_DIR, 'worker.port');
const TIMEOUT_MS = 750;

function logErr(msg) {
  try {
    fs.mkdirSync(CCTM_DIR, { recursive: true });
    fs.appendFileSync(ERR_LOG, `${new Date().toISOString()} ${msg}\n`);
  } catch (_) {}
}

function readPort() {
  if (process.env.CCTM_PORT) return Number(process.env.CCTM_PORT) || 39636;
  try {
    const v = fs.readFileSync(PORT_FILE, 'utf8').trim();
    return Number(v) || 39636;
  } catch (_) {
    return 39636;
  }
}

const event = process.argv[2] || 'unknown';
let body = '';
process.stdin.on('data', (c) => { body += c.toString('utf8'); });
process.stdin.on('end', () => {
  const port = readPort();
  const req = http.request({
    host: '127.0.0.1',
    port,
    path: `/hook/${encodeURIComponent(event)}`,
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
  }, (res) => { res.resume(); res.on('end', () => process.exit(0)); });
  req.setTimeout(TIMEOUT_MS, () => { try { req.destroy(); } catch (_) {} process.exit(0); });
  req.on('error', (e) => { logErr(`${event} ${e.message}`); process.exit(0); });
  req.end(body);
});
process.stdin.on('error', () => process.exit(0));
// Safety net: hard exit after timeout regardless.
setTimeout(() => process.exit(0), TIMEOUT_MS + 100).unref();
